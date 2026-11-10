// The icon pipeline's commands: optimize the source SVGs, check them, and
// build every package, the registry, and the web assets from them.
// Usage: bun scripts/icons.mjs <optimize|check|build|font-codepoints|preview|og|outputs>
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { optimize } from "svgo";
import { reattachEnds, smoothCorners } from "./corner-smoothing.mjs";
import { iconSvg, svgInner, svgPathData } from "./icon-styles.mjs";
import {
  asArray,
  iconCategories,
  iconNames,
  lucideMetadata,
  parseSvg,
  readIcons,
  sourceDirectory,
  styles,
  subpathWithoutMove,
  validateIconMetadata,
  validateIconName,
  validateLucidePins,
  validateStyleTwins,
  validateSvgContent,
} from "./icon-source.mjs";
import { root, shadcnRegistryDirectory } from "./lib/paths.mjs";
import { registryUrl, targets } from "./packages.mjs";
import { cleanPaths } from "./path-cleanup.mjs";
import { evenOddPathData, loadPathKit } from "./skia-path.mjs";
import { assertGeneratorsMatchPackages, generators, packageApis } from "./generators/index.mjs";
import { buildOg, buildPreview, ogPath, previewPath } from "./generators/images.mjs";
import { assertIconNodesPassRuntimePolicy } from "./generators/runtime-policy.mjs";
import { buildShadcnRegistry } from "./generators/shadcn.mjs";
import { allocateFontCodepoints, fontCodepointsPath } from "./generators/static.mjs";
import { buildWebAssets } from "./generators/web.mjs";

const iconCountFiles = [path.join(root, "README.md"), path.join(root, "apps/docs/docs/index.mdx")];
const iconCountPattern =
  /(<!-- vadivam-icon-count:start -->[\s\S]*?)(\d+)([\s\S]*?<!-- vadivam-icon-count:end -->)/g;
const categoriesDocPath = path.join(root, "apps/docs/docs/(icons)/03-categories.mdx");
const categoryTablePattern =
  /(<!-- vadivam-categories:start --> \*\/\}(\r?\n))[\s\S]*?(\r?\n\{\/\* <!-- vadivam-categories:end -->)/;
const packageReadmes = targets.map((target) => [target, path.join(root, target.directory, "README.md")]);
const packageFamilyPattern = /(<!-- vadivam-packages:start -->\r?\n)[\s\S]*?(\r?\n<!-- vadivam-packages:end -->)/;

/** Committed files the icon commands rewrite, which CI and the pre-commit hook check. */
export const committedOutputs = [
  ...Object.values(styles).map(sourceDirectory),
  ...iconCountFiles,
  categoriesDocPath,
  ...packageReadmes.map(([, readme]) => readme),
  previewPath,
  ogPath,
  fontCodepointsPath,
].map((file) => path.relative(root, file));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const svgoConfig = {
  multipass: true,
  plugins: [
    {
      name: "preset-default",
      params: {
        overrides: {
          cleanupIds: false,
          convertShapeToPath: false,
        },
      },
    },
  ],
};

// Solid icons take their paint from the root, so a shape the source leaves
// unpainted is dropped before its fill="none" is stripped and it turns to ink.
// Unused ids are cleaned up first, since SVGO skips a shape that has one.
const filledSvgoConfig = {
  ...svgoConfig,
  plugins: [
    {
      name: "preset-default",
      params: {
        overrides: {
          convertShapeToPath: false,
          removeUselessStrokeAndFill: { removeNone: true },
        },
      },
    },
  ],
};

function optimizeSvg(svg, file, config = svgoConfig) {
  const result = optimize(svg, { ...config, path: file });
  if (result.error) throw new Error(`${file}: ${result.error}`);
  return result.data;
}

const pathPattern = /(<path\b[^>]*\sd=")([^"]*)("[^>]*>)/g;
const mapPathData = (svg, map) => svg.replace(pathPattern, (_match, prefix, d, suffix) => `${prefix}${map(d)}${suffix}`);

// SVGO drops the move after a closepath when the next subpath starts where
// the last one began; WebKit draws some of those from the wrong point. A lineto
// right after the move is written the way SVGO writes it, so optimizing again
// changes nothing.
function restoreSubpathMoves(d) {
  return d.replace(subpathWithoutMove, "$1m0 0").replace(/([zZ]m0 0)l(?=\d|\.)/g, "$1 ").replace(/([zZ]m0 0)l(?=-)/g, "$1");
}

// The optimized shapes inside the style's root, without the paint attributes
// the root now sets, validated.
function withStyleRoot(optimized, file, style, paint) {
  // SVGO writes a self-closing root when every shape was dropped.
  assert(optimized.includes("</svg>"), `${file}: optimized SVG is missing root`);
  const normalized = iconSvg(style, svgInner(mapPathData(optimized, restoreSubpathMoves)).replace(paint, "").trim());
  validateSvgContent(normalized, file, style);
  return normalized;
}

// Outline artwork may not be filled, and solid artwork may not be stroked:
// either would be lost when the root attributes are rewritten.
function assertSourcePaint(svg, file, style) {
  const paint = style.stroked ? "@_fill" : "@_stroke";
  // The root counts too: its paint is inherited by every shape.
  const visit = (current) => {
    const value = current[paint];
    assert(
      value === undefined || value === "none",
      style.stroked
        ? `${file}: filled artwork cannot be normalized; use open centerline strokes instead of outlined stroke geometry`
        : `${file}: stroked artwork cannot be normalized; outline strokes into filled shapes for solid icons`,
    );
    for (const [tag, children] of Object.entries(current)) {
      if (tag.startsWith("@_")) continue;
      for (const item of asArray(children)) {
        if (item && typeof item === "object") visit(item);
      }
    }
  };
  visit(parseSvg(svg, file));
}

export function normalizeSvg(svg, file, style = styles.outline) {
  assertSourcePaint(svg, file, style);
  return style.stroked ? normalizeStrokedSvg(svg, file, style) : normalizeFilledSvg(svg, file, style);
}

// SVGO turns Figma's circular curves into arcs, so rounded corners can be
// found and smoothed; a last pass compacts the rewritten path data. Strokes
// Figma split apart are joined first, and SVGO runs again on the joined
// outline, so smoothing sees whole corners. Only path data is swapped; every
// other attribute stays for validation to judge.
function normalizeStrokedSvg(svg, file, style) {
  const replacePaths = (content, paths) => {
    let index = 0;
    return content.replace(pathPattern, (match, prefix, d, suffix) => {
      const next = paths[index++];
      if (next !== null) return `${prefix}${next}${suffix}`;
      return suffix.endsWith("/>") ? "" : match;
    });
  };
  const first = optimizeSvg(svg, file);
  const cleaned = optimizeSvg(replacePaths(first, cleanPaths(svgPathData(first)).paths), file);
  const original = svgPathData(cleaned);
  const smoothed = replacePaths(cleaned, reattachEnds(original, original.map((d) => smoothCorners(d))));
  return withStyleRoot(
    optimizeSvg(smoothed, file),
    file,
    style,
    /\s(?:fill|stroke|stroke-width|stroke-linecap|stroke-linejoin)="[^"]*"/g,
  );
}

const pathKit = await loadPathKit();

// Filled artwork has no strokes to join or trim, so it is only compacted and
// its rounded corners smoothed, like an outline's.
function normalizeFilledSvg(svg, file, style) {
  let optimized = optimizeSvg(svg, file, filledSvgoConfig);
  // The root's fill-rule replaces each shape's own, so a path Figma fills by
  // nonzero winding is redrawn first to fill the same area by evenodd.
  const rootRule = optimized.match(/<svg\b[^>]*>/)?.[0].match(/\sfill-rule="([^"]*)"/)?.[1];
  optimized = optimized.replace(pathPattern, (match, prefix, d, suffix) => {
    const rule = match.match(/\sfill-rule="([^"]*)"/)?.[1] ?? rootRule ?? "nonzero";
    const converted = rule === "evenodd" ? null : evenOddPathData(pathKit, d);
    return converted ? `${prefix}${converted}${suffix}` : match;
  });
  // SVGO can turn a smoothed curve back into an arc, so repeat until stable.
  for (let pass = 0; pass < 4; pass += 1) {
    const next = optimizeSvg(mapPathData(optimized, smoothCorners), file);
    if (next === optimized) break;
    optimized = next;
  }
  return withStyleRoot(
    optimized,
    file,
    style,
    /\s(?:fill|fill-rule|clip-rule|stroke|stroke-width|stroke-linecap|stroke-linejoin)="[^"]*"/g,
  );
}

export function updateIconCountMarkers(content, count) {
  let matches = 0;
  const updated = content.replace(iconCountPattern, (_match, before, _current, after) => {
    matches += 1;
    return `${before}${count}${after}`;
  });
  assert(matches > 0, "missing vadivam icon count markers");
  return updated;
}

// The categories table lists each category with its icon count, linked to the
// homepage filter, so the docs page stays in step with the set.
function categoryTable(names) {
  const rows = iconCategories.map(({ id, title, description = "" }) => {
    const count = names.filter((name) => lucideMetadata.icons[name]?.categories.includes(id)).length;
    return `| [${title}](/?category=${id}) | ${count} | ${description} |`;
  });
  return ["| Category | Icons | Description |", "| --- | --: | --- |", ...rows].join("\n");
}

export function updateCategoryTableMarkers(content, names) {
  assert(categoryTablePattern.test(content), "missing vadivam categories markers");
  return content.replace(categoryTablePattern, (_match, before, newline, after) =>
    `${before}${newline}${categoryTable(names).replaceAll("\n", newline)}${newline}${after}`,
  );
}

// Each package README links every other package in scripts/packages.mjs.
export function updatePackageFamilyMarkers(content, target) {
  assert(packageFamilyPattern.test(content), `missing vadivam-packages markers in the ${target.packageName} README`);
  const family = targets.filter((other) => other !== target).map((other) => `[${other.label}](${registryUrl(other)})`);
  return content.replace(packageFamilyPattern, (_match, start, end) => `${start}Package family: ${family.join(" · ")}${end}`);
}

async function synchronizeDocCounts(names, { check = false } = {}) {
  const updates = [
    ...iconCountFiles.map((filePath) => [filePath, (content) => updateIconCountMarkers(content, names.length)]),
    [categoriesDocPath, (content) => updateCategoryTableMarkers(content, names)],
    ...packageReadmes.map(([target, readme]) => [readme, (content) => updatePackageFamilyMarkers(content, target)]),
  ];
  for (const [filePath, update] of updates) {
    const original = await readFile(filePath, "utf8");
    const updated = update(original);
    if (updated === original) continue;
    assert(!check, `${path.relative(root, filePath)}: generated sections are stale; run bun run icons:optimize`);
    await writeFile(filePath, updated);
  }
}

async function optimizeIcons() {
  const normalizedIcons = [];
  for (const style of Object.values(styles)) {
    for (const name of await iconNames(style)) {
      const filePath = path.join(sourceDirectory(style), `${name}.svg`);
      normalizedIcons.push([filePath, normalizeSvg(await readFile(filePath, "utf8"), `${name}.svg`, style)]);
    }
  }
  for (const [filePath, svg] of normalizedIcons) {
    await writeFile(filePath, svg);
  }
  const names = await iconNames();
  await synchronizeDocCounts(names);
  console.log(`Optimized ${names.length} icons in ${Object.keys(styles).length} styles.`);
}

async function checkIcons() {
  const namesByStyle = {};
  for (const style of Object.values(styles)) {
    namesByStyle[style.id] = await iconNames(style);
    for (const name of namesByStyle[style.id]) {
      validateIconName(name, `${name}.svg`);
      const file = path.join(sourceDirectory(style), `${name}.svg`);
      validateSvgContent(await readFile(file, "utf8"), path.relative(root, file), style);
    }
  }
  validateStyleTwins(namesByStyle);
  validateIconMetadata(namesByStyle.outline);
  await validateLucidePins(namesByStyle.outline);
  await synchronizeDocCounts(namesByStyle.outline, { check: true });
  console.log(
    `Checked ${namesByStyle.outline.length} icons in ${Object.keys(styles).length} styles against Lucide ${lucideMetadata.lucideVersion}.`,
  );
}

async function build() {
  assertGeneratorsMatchPackages();
  const iconsByStyle = {};
  for (const style of Object.values(styles)) iconsByStyle[style.id] = await readIcons(style);
  const names = iconsByStyle.outline.map((icon) => icon.name);
  validateStyleTwins(Object.fromEntries(Object.entries(iconsByStyle).map(([id, icons]) => [id, icons.map((icon) => icon.name)])));
  // The MCP data ranks icons by the Lucide rankings, so they must be for the pinned release.
  await validateLucidePins(names);
  await assertIconNodesPassRuntimePolicy(Object.values(iconsByStyle).flat());
  await synchronizeDocCounts(names);
  for (const target of targets) {
    await generators[target.id].build({ iconsByStyle, directory: path.join(root, target.directory), packageApis });
  }
  await buildWebAssets(iconsByStyle);
  await buildShadcnRegistry(iconsByStyle, shadcnRegistryDirectory);
  console.log(`Built packages and web assets for ${names.length} icons.`);
}

const commands = new Map([
  ["optimize", optimizeIcons],
  ["check", checkIcons],
  ["build", build],
  ["font-codepoints", async () => allocateFontCodepoints(await readIcons())],
  ["preview", buildPreview],
  ["og", buildOg],
  ["outputs", async () => console.log(committedOutputs.join("\n"))],
]);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const command = commands.get(process.argv[2]);
  if (!command) {
    console.error(`Usage: bun scripts/icons.mjs <${[...commands.keys()].join("|")}>`);
    process.exit(1);
  }
  await command();
}
