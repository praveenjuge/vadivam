import {
  chmod,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
  copyFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { elementPathData, inkBounds, parsePath, shortStrokeEnds } from "./icon-geometry.mjs";
import { findUnsmoothedCorners, reattachEnds, smoothCorners } from "./corner-smoothing.mjs";
import { cleanPaths, gridTolerance } from "./path-cleanup.mjs";
import { evenOddPathData, loadPathKit } from "./solid-draft.mjs";
import { optimize } from "svgo";
import { Resvg } from "@resvg/resvg-js";
import { buildAngularPackage } from "./generators/angular.mjs";
import { buildAstroPackage } from "./generators/astro.mjs";
import { buildComposePackage } from "./generators/compose.mjs";
import { buildElements } from "./generators/elements.mjs";
import { buildFlutterPackage } from "./generators/flutter.mjs";
import { buildLitPackage } from "./generators/lit.mjs";
import { buildMcpPackage } from "./generators/mcp.mjs";
import { buildPreactPackage } from "./generators/preact.mjs";
import { buildQwikPackage } from "./generators/qwik.mjs";
import { buildReactPackage } from "./generators/react.mjs";
import { buildReactNativePackage } from "./generators/react-native.mjs";
import { buildShadcnRegistry } from "./generators/shadcn.mjs";
import { buildSolidPackage } from "./generators/solid.mjs";
import { buildSveltePackage } from "./generators/svelte.mjs";
import { buildVuePackage } from "./generators/vue.mjs";
import {
  assertIconNodesPassRuntimePolicy,
  runtimePolicyRecursiveSource,
  svgElementTypeSource,
} from "./generators/runtime-policy.mjs";
import {
  allocateFontCodepoints,
  buildStaticAssets,
  fonts,
} from "./generators/static.mjs";
import { buildStyles, defaultAttributesSource } from "./generators/shared.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = path.join(root, "icons");
const solidIconsDir = path.join(root, "icons-solid");
const rawDist = path.join(root, "packages/vadivam/dist");
const rawSource = path.join(root, "packages/vadivam/src");
const lucideAliasesPath = path.join(root, "apps/vadivam-internal/src/data/lucide-deprecated-aliases.json");
const reactDist = path.join(root, "packages/vadivam-react/dist");
const reactNativeDist = path.join(root, "packages/vadivam-react-native/dist");
const vueDist = path.join(root, "packages/vadivam-vue/dist");
const svelteDist = path.join(root, "packages/vadivam-svelte/dist");
const solidDist = path.join(root, "packages/vadivam-solid/dist");
const angularPackage = path.join(root, "packages/vadivam-angular");
const astroDist = path.join(root, "packages/vadivam-astro/dist");
const preactDist = path.join(root, "packages/vadivam-preact/dist");
const litDist = path.join(root, "packages/vadivam-lit/dist");
const qwikDist = path.join(root, "packages/vadivam-qwik/dist");
const flutterPackage = path.join(root, "packages/vadivam-flutter");
const composePackage = path.join(root, "packages/vadivam-compose");
const mcpPackage = path.join(root, "packages/vadivam-mcp");
const skillSource = path.join(root, "apps/docs/skills/vadivam-icons/SKILL.md");
const rawSkills = path.join(root, "packages/vadivam/skills");
const webIconsDir = path.join(root, "apps/docs/public/icons");
const webSolidIconsDir = path.join(root, "apps/docs/public/icons-solid");
const shadcnRegistryDir = path.join(root, "apps/docs/public/r");
const previewPath = path.join(root, "apps/docs/public/preview.png");
const ogPath = path.join(root, "apps/docs/public/og.png");
const fontCodepointsPath = path.join(root, "scripts/font-codepoints.json");
const lucideMetadata = JSON.parse(
  await readFile(path.join(root, "metadata/lucide.json"), "utf8"),
);
const lucideVersion = lucideMetadata.lucideVersion;
const lucideTreeUrl = "https://api.github.com/repos/lucide-icons/lucide/git/trees";
const iconCountFiles = [
  path.join(root, "README.md"),
  path.join(root, "apps/docs/docs/index.mdx"),
];
const iconCountPattern =
  /(<!-- vadivam-icon-count:start -->[\s\S]*?)(\d+)([\s\S]*?<!-- vadivam-icon-count:end -->)/g;
const categoriesDocPath = path.join(root, "apps/docs/docs/(icons)/03-categories.mdx");
const categoryTablePattern =
  /(<!-- vadivam-categories:start --> \*\/\}(\r?\n))[\s\S]*?(\r?\n\{\/\* <!-- vadivam-categories:end -->)/;
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

const graphics = new Set([
  "path",
  "circle",
  "line",
  "polyline",
  "polygon",
  "rect",
  "ellipse",
]);
const geometryAttrs = {
  path: new Set(["@_d"]),
  circle: new Set(["@_cx", "@_cy", "@_r"]),
  line: new Set(["@_x1", "@_y1", "@_x2", "@_y2"]),
  polyline: new Set(["@_points"]),
  polygon: new Set(["@_points"]),
  rect: new Set(["@_x", "@_y", "@_width", "@_height", "@_rx", "@_ry"]),
  ellipse: new Set(["@_cx", "@_cy", "@_rx", "@_ry"]),
};
const canvasAttrs = {
  "@_xmlns": "http://www.w3.org/2000/svg",
  "@_width": "24",
  "@_height": "24",
  "@_viewBox": "0 0 24 24",
};
// Each style is one folder of SVGs with the same names. Outline icons are
// centerline strokes; solid icons are filled shapes whose cut-outs rely on the
// even-odd rule. Solid lines are 2.5px wide on the outline's centerlines, so
// their ink reaches 0.25px further into the padding than a 2px stroke.
export const styles = {
  outline: {
    id: "outline",
    directory: iconsDir,
    rootAttrs: {
      ...canvasAttrs,
      "@_fill": "none",
      "@_stroke": "currentColor",
      "@_stroke-width": "2",
      "@_stroke-linecap": "round",
      "@_stroke-linejoin": "round",
    },
    inkWidth: 2,
    padding: 1,
  },
  solid: {
    id: "solid",
    directory: solidIconsDir,
    rootAttrs: {
      ...canvasAttrs,
      "@_fill": "currentColor",
      "@_fill-rule": "evenodd",
    },
    inkWidth: 0,
    padding: 0.75,
  },
};

function rootTag(style) {
  const attrs = Object.entries(style.rootAttrs).map(([name, value]) => `${name.slice(2)}="${value}"`);
  return `<svg ${attrs.join(" ")}>`;
}
const blockedTags = new Set([
  "a",
  "clipPath",
  "defs",
  "filter",
  "foreignObject",
  "g",
  "image",
  "linearGradient",
  "mask",
  "pattern",
  "radialGradient",
  "script",
  "style",
  "symbol",
  "text",
  "use",
]);
const maxClosedSubpathsPerPath = 8;
const canvasSize = 24;

async function svgFiles(style = styles.outline) {
  return (await readdir(style.directory))
    .filter((file) => file.endsWith(".svg"))
    .sort();
}

function pascalCase(name) {
  return name
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function validateIconName(name, file = `${name}.svg`) {
  assert(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name),
    `${file}: icon filename must use lowercase kebab-case`,
  );
}

async function fetchJson(url, description, fetchImpl) {
  const headers = {
    Accept: "application/vnd.github+json, application/json",
    "User-Agent": "vadivam-icon-checker",
  };
  // Anonymous GitHub API calls from shared CI runners get rate-limited, so
  // send the job token when one is set.
  if (process.env.GITHUB_TOKEN && url.startsWith("https://api.github.com/")) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const response = await fetchImpl(url, { headers });
  assert(response.ok, `Could not fetch ${description}: HTTP ${response.status}`);
  try {
    return await response.json();
  } catch {
    throw new Error(`Could not parse ${description}`);
  }
}

export async function fetchPinnedLucideCatalog(fetchImpl = fetch) {
  const release = await fetchJson(
    `https://registry.npmjs.org/lucide/${lucideVersion}`,
    `the pinned Lucide ${lucideVersion} release`,
    fetchImpl,
  );
  assert(
    release && release.version === lucideVersion,
    `The pinned Lucide release must resolve to ${lucideVersion}`,
  );

  const tree = await fetchJson(
    `${lucideTreeUrl}/${release.version}?recursive=1`,
    `the Lucide ${release.version} source tree`,
    fetchImpl,
  );
  assert(
    tree && tree.truncated === false,
    `The Lucide ${release.version} source tree is incomplete`,
  );
  assert(Array.isArray(tree.tree), `The Lucide ${release.version} source tree is invalid`);

  const names = tree.tree
    .map((entry) => entry?.path)
    .filter(
      (entryPath) =>
        typeof entryPath === "string" && /^icons\/[^/]+\.svg$/.test(entryPath),
    )
    .map((entryPath) => entryPath.slice("icons/".length, -".svg".length));
  const uniqueNames = new Set(names);
  assert(uniqueNames.size === names.length, `Lucide ${release.version} has duplicate icon names`);
  assert(uniqueNames.size > 0, `Lucide ${release.version} has no canonical icon names`);

  return { version: release.version, names: uniqueNames };
}

export function validateLucideIconNames(fileNames, catalog) {
  const invalid = fileNames.filter(
    (fileName) => !catalog.names.has(fileName.replace(/\.svg$/, "")),
  );
  assert(
    invalid.length === 0,
    `Deprecated or non-canonical icon names for Lucide ${catalog.version}: ${invalid.join(", ")}. Rename them to current canonical Lucide names`,
  );
}

// Tags and categories come from Lucide's metadata for the pinned release, so
// each icon's search terms match the canonical name it is drawn for.
export function validateIconMetadata(names, metadata = lucideMetadata) {
  const known = new Set(names);
  const missing = names.filter((name) => !metadata.icons[name]);
  const orphaned = Object.keys(metadata.icons).filter((name) => !known.has(name));
  assert(missing.length === 0, `metadata/lucide.json has no entry for: ${missing.join(", ")}`);
  assert(orphaned.length === 0, `metadata/lucide.json lists icons with no SVG: ${orphaned.join(", ")}`);
  for (const name of names) {
    const { tags, categories } = metadata.icons[name];
    assert(
      Array.isArray(tags) && tags.every((tag) => typeof tag === "string" && tag.length > 0),
      `metadata/lucide.json: ${name} has invalid tags`,
    );
    assert(
      Array.isArray(categories) && categories.length > 0 && categories.every((id) => metadata.categories[id]),
      `metadata/lucide.json: ${name} needs at least one known category`,
    );
  }
}

export const iconCategories = Object.entries(lucideMetadata.categories).map(
  ([id, { title, description }]) => ({ id, title, ...(description && { description }) }),
);

function parseSvg(svg, file = "inline.svg") {
  const xmlCheck = XMLValidator.validate(svg);
  assert(xmlCheck === true, `${file}: invalid XML ${JSON.stringify(xmlCheck)}`);
  const parsed = parser.parse(svg);
  assert(
    parsed.svg && typeof parsed.svg === "object",
    `${file}: missing <svg> root`,
  );
  return parsed.svg;
}

function asArray(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

// A closepath followed straight by a drawing command, with no move to start the next subpath.
const subpathWithoutMove = /([zZ])\s*(?=[a-ln-yA-LN-Y])/g;

export function validateSvgContent(svg, file = "inline.svg", style = styles.outline) {
  const node = parseSvg(svg, file);
  for (const [attr, value] of Object.entries(style.rootAttrs)) {
    assert(
      node[attr] === value,
      `${file}: expected ${attr.slice(2)}="${value}"`,
    );
  }
  for (const key of Object.keys(node)) {
    if (key.startsWith("@_"))
      assert(
        key in style.rootAttrs,
        `${file}: unsupported root attribute ${key.slice(2)}`,
      );
  }

  let count = 0;
  const shapes = [];
  const visit = (current, parentTag) => {
    for (const [tag, value] of Object.entries(current)) {
      if (tag.startsWith("@_")) continue;
      assert(!blockedTags.has(tag), `${file}: unsupported <${tag}> element`);
      assert(graphics.has(tag), `${file}: unsupported <${tag}> element`);
      for (const item of asArray(value)) {
        count += 1;
        assert(
          item && typeof item === "object",
          `${file}: invalid <${tag}> element`,
        );
        const allowed = geometryAttrs[tag];
        if (tag === "path") {
          const pathData = item["@_d"];
          const closedSubpaths =
            typeof pathData === "string" ? (pathData.match(/z/gi) ?? []).length : 0;
          assert(
            style !== styles.outline || closedSubpaths <= maxClosedSubpathsPerPath,
            `${file}: path has ${closedSubpaths} closed subpaths and looks like expanded stroke geometry; use open centerline strokes`,
          );
          assertSmoothCorners(pathData, file);
        }
        if (tag === "rect") {
          assert(
            item["@_rx"] === undefined && item["@_ry"] === undefined,
            `${file}: <rect> corners cannot carry corner smoothing; draw rounded rectangles as paths`,
          );
        }
        for (const attr of Object.keys(item)) {
          if (attr.startsWith("@_")) {
            assert(
              allowed.has(attr),
              `${file}: unsupported ${tag} attribute ${attr.slice(2)}`,
            );
          } else {
            visit({ [attr]: item[attr] }, tag);
          }
        }
        assert(
          Object.keys(item).some((attr) => allowed.has(attr)),
          `${file}: <${tag}> has no geometry`,
        );
        shapes.push([
          tag,
          Object.fromEntries(
            Object.entries(item)
              .filter(([attr]) => allowed.has(attr))
              .map(([attr, attrValue]) => [attr.slice(2), attrValue]),
          ),
        ]);
      }
    }
  };

  visit(node, "svg");
  assert(count > 0, `${file}: no drawable elements found`);
  assertInkInsidePadding(shapes, file, style);
  const paths = shapes.filter(([tag]) => tag === "path").map(([, attrs]) => attrs.d);
  const unmoved = paths.filter((d) => d.search(subpathWithoutMove) >= 0).length;
  assert(unmoved === 0, `${file}: ${unmoved} path(s) start a subpath after "z" without a move; WebKit draws it from the wrong point, so add "m0 0" after the "z"`);
  // Path cleanup joins and trims strokes, which only applies to outlines.
  if (style === styles.outline) {
    assertCleanPaths(paths, file);
    assertStrokesMeet(shapes.map(([tag, attrs]) => elementPathData(tag, attrs)), file);
  }
}

// Every rounded corner between two straight lines must use the smoothed
// corner from scripts/corner-smoothing.mjs, never a plain circular arc.
function assertSmoothCorners(pathData, file) {
  if (typeof pathData !== "string") return;
  let corners;
  try {
    corners = findUnsmoothedCorners(pathData);
  } catch (error) {
    throw new Error(`${file}: ${error.message}`);
  }
  const format = (value) => Number(value.toFixed(3));
  assert(
    corners.length === 0,
    `${file}: ${corners.length} rounded corner(s) use a plain circular arc (first near ${format(corners[0]?.x ?? 0)}, ${format(corners[0]?.y ?? 0)}); run bun run icons:optimize to apply 60% corner smoothing`,
  );
}

// With round caps and joins the 2px stroke reaches 1px past the centerline, so
// keeping the ink inside the 1px padding keeps every point of the geometry at
// least 2px inside the canvas edge. Solid shapes are their own ink.
function assertInkInsidePadding(shapes, file, style = styles.outline) {
  const { padding } = style;
  let box;
  try {
    box = inkBounds(shapes, style.inkWidth);
  } catch (error) {
    throw new Error(`${file}: ${error.message}`);
  }
  // Path data keeps 3 decimals, so curves may overshoot the padding line by a
  // hair. Solid outlines are offset curves that SVGO refits as arcs, which
  // can overshoot a little more.
  const epsilon = style === styles.outline ? 0.01 : 0.05;
  const inside =
    box.minX >= padding - epsilon &&
    box.minY >= padding - epsilon &&
    box.maxX <= canvasSize - padding + epsilon &&
    box.maxY <= canvasSize - padding + epsilon;
  const format = (value) => Number(value.toFixed(3));
  assert(
    inside,
    style === styles.outline
      ? `${file}: stroke reaches into the 1px padding (ink spans x ${format(box.minX)} to ${format(box.maxX)}, y ${format(box.minY)} to ${format(box.maxY)}); keep geometry at least 2px from every edge`
      : `${file}: shape reaches into the ${padding}px padding (ink spans x ${format(box.minX)} to ${format(box.maxX)}, y ${format(box.minY)} to ${format(box.maxY)}); keep the shape at least ${padding}px from every edge`,
  );
}

// Path data must be what bun run icons:optimize writes: no stray subpaths, no
// strokes split where they meet, and no lines just off the whole-pixel grid.
function assertCleanPaths(paths, file) {
  if (paths.length === 0) return;
  const { debris, joins, merges, nodes, snaps } = cleanPaths(paths);
  const problems = [
    debris && `${debris} stray subpath(s)`,
    joins && `${joins} stroke(s) split where they meet`,
    merges && `${merges} straight line(s) split in pieces`,
    nodes && `${nodes} line(s) shorter than 0.05px inside a stroke`,
    snaps && `${snaps} line(s) less than ${gridTolerance}px off the whole-pixel grid`,
  ].filter(Boolean);
  assert(
    problems.length === 0,
    `${file}: ${problems.join(", ")}; run bun run icons:optimize to clean the path data`,
  );
}

// A stroke that stops just short of another overlaps it without meeting it.
function assertStrokesMeet(paths, file) {
  const ends = shortStrokeEnds(paths.flatMap((d) => parsePath(d)));
  const format = (value) => Number(value.toFixed(2));
  assert(
    ends.length === 0,
    `${file}: ${ends.length} stroke end(s) stop short of another stroke (first ${format(ends[0]?.distance ?? 0)}px short near ${format(ends[0]?.point[0] ?? 0)}, ${format(ends[0]?.point[1] ?? 0)}); join them, or leave a gap of at least 1.5px`,
  );
}

// Outline artwork may not be filled, and solid artwork may not be stroked:
// either would be lost when the root attributes are rewritten.
function assertSourcePaint(svg, file, style = styles.outline) {
  const paint = style === styles.outline ? "@_fill" : "@_stroke";
  // The root counts too: its paint is inherited by every shape.
  const visit = (current) => {
    const value = current[paint];
    assert(
      value === undefined || value === "none",
      style === styles.outline
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

function iconNodeFromSvg(svg, file) {
  const node = parseSvg(svg, file);
  const iconNode = [];
  for (const tag of graphics) {
    for (const item of asArray(node[tag])) {
      const attrs = {};
      for (const [attr, value] of Object.entries(item)) {
        if (geometryAttrs[tag].has(attr)) attrs[attr.slice(2)] = value;
      }
      attrs.key = `${tag}-${iconNode.length}`;
      iconNode.push([tag, attrs]);
    }
  }
  return iconNode;
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

// SVGO drops the move after a closepath when the next subpath starts where
// the last one began; WebKit draws some of those from the wrong point. A lineto
// right after the move is written the way SVGO writes it, so optimizing again
// changes nothing.
function restoreSubpathMoves(d) {
  return d.replace(subpathWithoutMove, "$1m0 0").replace(/([zZ]m0 0)l(?=\d|\.)/g, "$1 ").replace(/([zZ]m0 0)l(?=-)/g, "$1");
}

export function normalizeSvg(svg, file, style = styles.outline) {
  assertSourcePaint(svg, file, style);
  if (style !== styles.outline) return normalizeFilledSvg(svg, file, style);
  // SVGO turns Figma's circular curves into arcs, so rounded corners can be
  // found and smoothed; a last pass compacts the rewritten path data. Strokes
  // Figma split apart are joined first, and SVGO runs again on the joined
  // outline, so smoothing sees whole corners.
  // Only path data is swapped; every other attribute stays for validation to judge.
  const pathPattern = /(<path\b[^>]*\sd=")([^"]*)("[^>]*>)/g;
  const pathData = (content) => [...content.matchAll(pathPattern)].map((match) => match[2]);
  const replacePaths = (content, paths) => {
    let index = 0;
    return content.replace(pathPattern, (match, prefix, d, suffix) => {
      const next = paths[index++];
      if (next !== null) return `${prefix}${next}${suffix}`;
      return suffix.endsWith("/>") ? "" : match;
    });
  };
  const first = optimizeSvg(svg, file);
  const cleaned = optimizeSvg(replacePaths(first, cleanPaths(pathData(first)).paths), file);
  const original = pathData(cleaned);
  const smoothed = replacePaths(cleaned, reattachEnds(original, original.map((d) => smoothCorners(d))));
  const optimized = optimizeSvg(smoothed, file).replace(pathPattern, (_match, prefix, d, suffix) => `${prefix}${restoreSubpathMoves(d)}${suffix}`);
  const open = optimized.match(/<svg\b[^>]*>/);
  const close = optimized.lastIndexOf("</svg>");
  assert(open && close > -1, `${file}: optimized SVG is missing root`);
  const inner = optimized
    .slice(open.index + open[0].length, close)
    .replace(
      /\s(?:fill|stroke|stroke-width|stroke-linecap|stroke-linejoin)="[^"]*"/g,
      "",
    )
    .trim();
  const normalized = `${rootTag(style)}\n${inner}\n</svg>\n`;
  validateSvgContent(normalized, file);
  return normalized;
}

const pathKit = await loadPathKit();

// Filled artwork has no strokes to join or trim, so it is only compacted and
// its rounded corners smoothed, like an outline's.
function normalizeFilledSvg(svg, file, style) {
  const pathPattern = /(<path\b[^>]*\sd=")([^"]*)("[^>]*>)/g;
  const smooth = (content) =>
    content.replace(pathPattern, (_match, prefix, d, suffix) => `${prefix}${smoothCorners(d)}${suffix}`);
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
    const next = optimizeSvg(smooth(optimized), file);
    if (next === optimized) break;
    optimized = next;
  }
  optimized = optimized.replace(pathPattern, (_match, prefix, d, suffix) => `${prefix}${restoreSubpathMoves(d)}${suffix}`);
  const open = optimized.match(/<svg\b[^>]*>/);
  const close = optimized.lastIndexOf("</svg>");
  assert(open && close > -1, `${file}: optimized SVG is missing root`);
  const inner = optimized
    .slice(open.index + open[0].length, close)
    .replace(/\s(?:fill|fill-rule|clip-rule|stroke|stroke-width|stroke-linecap|stroke-linejoin)="[^"]*"/g, "")
    .trim();
  const normalized = `${rootTag(style)}\n${inner}\n</svg>\n`;
  validateSvgContent(normalized, file, style);
  return normalized;
}

export async function readIcons(style = styles.outline) {
  const files = await svgFiles(style);
  const icons = [];
  for (const fileName of files) {
    const name = fileName.replace(/\.svg$/, "");
    validateIconName(name, fileName);
    const filePath = path.join(style.directory, fileName);
    const svg = await readFile(filePath, "utf8");
    validateSvgContent(svg, fileName, style);
    const iconNode = iconNodeFromSvg(svg, fileName);
    icons.push({
      name,
      componentName: pascalCase(name),
      fileName,
      svgPath: `${path.relative(root, style.directory)}/${fileName}`,
      tags: lucideMetadata.icons[name]?.tags ?? [],
      categories: lucideMetadata.icons[name]?.categories ?? [],
      svg,
      iconNode,
    });
  }
  validateIconMetadata(icons.map((icon) => icon.name));
  return icons;
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
export function categoryTable(names) {
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

async function synchronizeDocCounts(names, { check = false } = {}) {
  const updates = [
    ...iconCountFiles.map((filePath) => [filePath, (content) => updateIconCountMarkers(content, names.length)]),
    [categoriesDocPath, (content) => updateCategoryTableMarkers(content, names)],
  ];
  for (const [filePath, update] of updates) {
    const original = await readFile(filePath, "utf8");
    const updated = update(original);
    if (updated === original) continue;
    const relativePath = path.relative(root, filePath);
    assert(!check, `${relativePath}: icon counts are stale; run bun run icons:optimize`);
    await writeFile(filePath, updated);
  }
}

export async function optimizeIcons() {
  const files = await svgFiles();
  const normalizedIcons = [];
  for (const style of Object.values(styles)) {
    for (const fileName of await svgFiles(style)) {
      const filePath = path.join(style.directory, fileName);
      const svg = await readFile(filePath, "utf8");
      normalizedIcons.push([filePath, normalizeSvg(svg, fileName, style)]);
    }
  }
  for (const [filePath, svg] of normalizedIcons) {
    await writeFile(filePath, svg);
  }
  await synchronizeDocCounts(files.map((fileName) => fileName.replace(/\.svg$/, "")));
  console.log(`Optimized ${files.length} icons in ${Object.keys(styles).length} styles.`);
}

// Every icon is drawn in every style, under the same name.
export function validateStyleTwins(namesByStyle) {
  const [[firstStyle, expected], ...others] = Object.entries(namesByStyle);
  const expectedSet = new Set(expected);
  for (const [style, names] of others) {
    const set = new Set(names);
    const missing = expected.filter((name) => !set.has(name));
    const extra = names.filter((name) => !expectedSet.has(name));
    assert(
      missing.length === 0,
      `${style} is missing ${missing.length} icon(s) drawn in ${firstStyle}: ${missing.slice(0, 10).join(", ")}${missing.length > 10 ? ", …" : ""}`,
    );
    assert(
      extra.length === 0,
      `${style} has ${extra.length} icon(s) with no ${firstStyle} twin: ${extra.slice(0, 10).join(", ")}${extra.length > 10 ? ", …" : ""}`,
    );
  }
}

export async function checkIcons() {
  const files = await svgFiles();
  const namesByStyle = {};
  for (const style of Object.values(styles)) {
    const styleFiles = await svgFiles(style);
    for (const fileName of styleFiles) {
      validateIconName(fileName.replace(/\.svg$/, ""), fileName);
      validateSvgContent(
        await readFile(path.join(style.directory, fileName), "utf8"),
        `${path.relative(root, style.directory)}/${fileName}`,
        style,
      );
    }
    namesByStyle[style.id] = styleFiles.map((fileName) => fileName.replace(/\.svg$/, ""));
  }
  validateStyleTwins(namesByStyle);
  validateIconMetadata(files.map((fileName) => fileName.replace(/\.svg$/, "")));
  const lucideCatalog = await fetchPinnedLucideCatalog();
  validateLucideIconNames(files, lucideCatalog);
  await synchronizeDocCounts(files.map((fileName) => fileName.replace(/\.svg$/, "")), { check: true });
  console.log(
    `Checked ${files.length} icons in ${Object.keys(styles).length} styles against Lucide ${lucideCatalog.version} canonical names.`,
  );
}

// The package root holds what every style shares: types, the runtime policy,
// the manifest, the fonts, and the CLI. Each style is an entry with its icons,
// strings, sprite, and DOM helpers: outline at the root, solid under solid/.
async function buildRawPackage(icons, solidIcons = []) {
  await rm(rawDist, { recursive: true, force: true });
  await mkdir(path.join(rawDist, "icons"), { recursive: true });
  const iconNameType = icons
    .map((icon) => JSON.stringify(icon.name))
    .join(" | ");
  await writeFile(
    path.join(rawDist, "types.d.ts"),
    `export type SVGElementType = ${svgElementTypeSource};\nexport type SVGProps = Record<string, string | number | boolean | undefined>;\nexport type IconNode = readonly [tag: SVGElementType, attrs: SVGProps, children?: IconNode][];\nexport type Icons = Record<string, IconNode>;\nexport type IconName = ${iconNameType};\n`,
  );
  await writeFile(
    path.join(rawDist, "runtimePolicy.js"),
    runtimePolicyRecursiveSource,
  );
  await buildStyles(rawDist, { outline: icons, solid: solidIcons }, (dist, styleIcons, style) =>
    buildRawEntry(dist, styleIcons, style),
  );
  await buildElements(icons, rawDist, solidIcons);
  const solidByName = new Map(solidIcons.map((icon) => [icon.name, icon]));
  const manifestIcons = icons.map((icon) => {
    const solid = solidByName.get(icon.name);
    // The package ships solid SVGs under solid/icons, not the repository's
    // icons-solid folder.
    return solid
      ? { ...icon, solid: { svgPath: `solid/icons/${solid.fileName}`, svg: solid.svg, iconNode: solid.iconNode } }
      : icon;
  });
  const manifest = JSON.stringify(manifestIcons, null, 2);
  const manifestStyles = solidIcons.length ? ["outline", "solid"] : ["outline"];
  await writeFile(
    path.join(rawDist, "manifest.js"),
    `export const icons = ${manifest};\nexport const iconNames = icons.map((icon) => icon.name);\nexport const iconsByName = Object.fromEntries(icons.map((icon) => [icon.name, icon]));\nexport const categories = ${JSON.stringify(iconCategories, null, 2)};\nexport const styles = ${JSON.stringify(manifestStyles)};\nexport default icons;\n`,
  );
  await writeFile(
    path.join(rawDist, "manifest.d.ts"),
    `import type { IconName, IconNode } from "./types.js";\nexport interface VadivamIconStyle {\n  svgPath: \`solid/icons/${"${IconName}"}.svg\`;\n  svg: string;\n  iconNode: IconNode;\n}\nexport interface VadivamIconMetadata {\n  name: IconName;\n  componentName: string;\n  fileName: \`${"${IconName}"}.svg\`;\n  svgPath: \`icons/${"${IconName}"}.svg\`;\n  /** Search terms from Lucide's metadata for this icon. */\n  tags: readonly string[];\n  /** Ids from \`categories\`. */\n  categories: readonly IconCategoryId[];\n  svg: string;\n  iconNode: IconNode;\n  /** The solid twin, drawn under the same name. */\n  solid?: VadivamIconStyle;\n}\nexport type IconCategoryId = ${iconCategories.map((category) => JSON.stringify(category.id)).join(" | ")};\nexport interface VadivamIconCategory {\n  id: IconCategoryId;\n  title: string;\n  description?: string;\n}\nexport type VadivamIconStyleId = "outline" | "solid";\nexport declare const icons: readonly VadivamIconMetadata[];\nexport declare const iconNames: readonly IconName[];\nexport declare const iconsByName: Record<IconName, VadivamIconMetadata>;\nexport declare const categories: readonly VadivamIconCategory[];\n/** The styles every icon is drawn in. */\nexport declare const styles: readonly VadivamIconStyleId[];\nexport default icons;\n`,
  );
  // The Lucide migration CLI is hand-written in packages/vadivam/src and reads
  // the generated manifest next to it, plus the deprecated Lucide aliases the
  // maintenance plugin tracks, so it can move alias imports to canonical names.
  for (const file of ["cli.js", "migrate-lucide.js"]) {
    await copyFile(path.join(rawSource, file), path.join(rawDist, file));
  }
  await chmod(path.join(rawDist, "cli.js"), 0o755);
  const names = new Set(icons.map((icon) => icon.name));
  const aliases = Object.fromEntries(
    Object.entries(JSON.parse(await readFile(lucideAliasesPath, "utf8"))).filter(
      ([alias, name]) => !names.has(alias) && names.has(name),
    ),
  );
  await writeFile(
    path.join(rawDist, "lucide-aliases.js"),
    `// Deprecated Lucide names and the canonical icon each one now points to.\nexport const lucideAliases = ${JSON.stringify(aliases)};\n`,
  );
  // The docs site serves the same skill at /skill.md; ship one copy with the package.
  await rm(rawSkills, { recursive: true, force: true });
  await mkdir(path.join(rawSkills, "vadivam-icons"), { recursive: true });
  await copyFile(skillSource, path.join(rawSkills, "vadivam-icons/SKILL.md"));
}

async function buildRawEntry(dist, icons, style) {
  const shared = style.shared;
  const sourceDirectory = style.stroked ? iconsDir : solidIconsDir;
  await mkdir(path.join(dist, "icons"), { recursive: true });
  for (const icon of icons) {
    const rawIconNode = icon.iconNode.map(([tag, attrs]) => [
      tag,
      Object.fromEntries(
        Object.entries(attrs).filter(([name]) => name !== "key"),
      ),
    ]);
    await copyFile(
      path.join(sourceDirectory, icon.fileName),
      path.join(dist, "icons", icon.fileName),
    );
    await writeFile(
      path.join(dist, "icons", `${icon.name}.js`),
      `const ${icon.componentName} = ${JSON.stringify(rawIconNode)};\nexport default ${icon.componentName};\n`,
    );
    await writeFile(
      path.join(dist, "icons", `${icon.name}.d.ts`),
      `import type { IconNode } from "../${shared === "./" ? "" : "../"}types.js";\n/** @name ${icon.name}\n * @description Vadivam ${style.stroked ? "" : "solid "}SVG icon node.\n * @see https://vadivam.praveenjuge.com/icons/${icon.name}\n */\ndeclare const ${icon.componentName}: IconNode;\nexport default ${icon.componentName};\n`,
    );
  }
  const rawImports = icons
    .map(
      (icon) => `import ${icon.componentName} from "./icons/${icon.name}.js";`,
    )
    .join("\n");
  const rawNamedExports = icons
    .map(
      (icon) =>
        `export { default as ${icon.componentName} } from "./icons/${icon.name}.js";`,
    )
    .join("\n");
  const rawIconEntries = icons
    .map((icon) => `  ${icon.componentName}`)
    .join(",\n");
  const rawIconTypes = icons
    .map((icon) => `  readonly ${icon.componentName}: IconNode;`)
    .join("\n");
  await writeFile(
    path.join(dist, "defaultAttributes.js"),
    `const defaultAttributes = ${defaultAttributesSource(style)};\nexport default defaultAttributes;\n`,
  );
  await writeFile(
    path.join(dist, "createElement.js"),
    `import defaultAttributes from "./defaultAttributes.js";\nimport { sanitizeIconNode, sanitizeRootAttributes } from "${shared}runtimePolicy.js";\n\nfunction createSvgElement(document, [tag, attrs, children]) {\n  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);\n  for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, String(value));\n  for (const child of children ?? []) element.appendChild(createSvgElement(document, child));\n  return element;\n}\n\nexport function createElement(iconNode, customAttrs = {}) {\n  if (typeof document === "undefined") throw new Error("createElement() only works in a browser environment.");\n  return createSvgElement(document, ["svg", { ...defaultAttributes, ...sanitizeRootAttributes(customAttrs) }, sanitizeIconNode(iconNode)]);\n}\nexport default createElement;\n`,
  );
  await writeFile(
    path.join(dist, "createElement.d.ts"),
    `import type { IconNode, SVGProps } from "${shared}types.js";\nexport declare function createElement(iconNode: IconNode, customAttrs?: SVGProps): SVGElement;\nexport default createElement;\n`,
  );
  await writeFile(
    path.join(dist, "iconNodes.js"),
    `${rawImports}\n\nexport const icons = {\n${rawIconEntries}\n};\nexport default icons;\n`,
  );
  await writeFile(
    path.join(dist, "iconNodes.d.ts"),
    `import type { IconNode } from "${shared}types.js";\nexport declare const icons: {\n${rawIconTypes}\n};\nexport default icons;\n`,
  );
  await writeFile(
    path.join(dist, "createIcons.js"),
    `import createElement from "./createElement.js";
import defaultAttributes from "./defaultAttributes.js";

function attributes(element) {
  return Object.fromEntries(Array.from(element.attributes, ({ name, value }) => [name, value]));
}
function classes(value) {
  if (Array.isArray(value)) return value;
  return typeof value === "string" ? value.split(/\\s+/).filter(Boolean) : [];
}
function hasAccessibleName(attrs) {
  return Object.keys(attrs).some((name) => name.startsWith("aria-") || name === "role" || name === "title");
}
function replaceElement(element, { nameAttr, icons, attrs }) {
  const name = element.getAttribute(nameAttr);
  if (!name) return;
  const componentName = name.split("-").filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join("");
  const iconNode = icons[componentName];
  if (!iconNode) {
    console.warn(\`\${element.outerHTML} icon name was not found in the provided icons object.\`);
    return;
  }
  const elementAttrs = attributes(element);
  const iconAttrs = { ...defaultAttributes, [nameAttr]: name, ...(hasAccessibleName(elementAttrs) ? {} : { "aria-hidden": "true" }), ...attrs, ...elementAttrs };
  iconAttrs.class = ["vadivam", \`vadivam-\${name}\`, ...classes(elementAttrs.class), ...classes(attrs.class)].filter((value, index, all) => value && all.indexOf(value) === index).join(" ");
  element.parentNode?.replaceChild(createElement(iconNode, iconAttrs), element);
}

export function createIcons({ icons = {}, nameAttr = "data-vadivam", attrs = {}, root = globalThis.document, inTemplates = false } = {}) {
  if (!Object.keys(icons).length) throw new Error("Please provide an icons object to createIcons().");
  if (!root) throw new Error("createIcons() only works in a browser environment.");
  if (!/^[A-Za-z_:][A-Za-z0-9_.:-]*$/.test(nameAttr)) throw new Error("createIcons() received an invalid nameAttr.");
  for (const element of root.querySelectorAll(\`[\${nameAttr}]\`)) replaceElement(element, { nameAttr, icons, attrs });
  if (inTemplates) {
    for (const template of root.querySelectorAll("template")) createIcons({ icons, nameAttr, attrs, root: template.content, inTemplates });
  }
}
export default createIcons;
`,
  );
  await writeFile(
    path.join(dist, "createIcons.d.ts"),
    `import type { Icons, SVGProps } from "${shared}types.js";\nexport interface CreateIconsOptions {\n  icons?: Icons;\n  nameAttr?: string;\n  attrs?: SVGProps;\n  root?: Element | Document | DocumentFragment;\n  inTemplates?: boolean;\n}\nexport declare function createIcons(options?: CreateIconsOptions): void;\nexport default createIcons;\n`,
  );
  const manifestExports = style.stroked
    ? `export { icons as manifest, iconNames, iconsByName, categories, styles } from "./manifest.js";\n`
    : "";
  const manifestTypes = style.stroked
    ? `export type { IconCategoryId, VadivamIconCategory, VadivamIconMetadata, VadivamIconStyle, VadivamIconStyleId } from "./manifest.js";\n`
    : "";
  await writeFile(
    path.join(dist, "index.js"),
    `export { createElement } from "./createElement.js";\nexport { createIcons } from "./createIcons.js";\nexport { icons } from "./iconNodes.js";\n${manifestExports}${rawNamedExports}\n`,
  );
  await writeFile(
    path.join(dist, "index.d.ts"),
    `export { createElement } from "./createElement.js";\nexport { createIcons } from "./createIcons.js";\nexport { icons } from "./iconNodes.js";\n${manifestExports}${rawNamedExports}\nexport type { CreateIconsOptions } from "./createIcons.js";\n${manifestTypes}export type { IconName, IconNode, Icons, SVGElementType, SVGProps } from "${shared}types.js";\n`,
  );
  await buildStaticAssets(icons, {
    iconsDirectory: sourceDirectory,
    outputDirectory: dist,
    fontDirectory: path.join(rawDist, "font"),
    registryPath: fontCodepointsPath,
    root,
    font: fonts[style.id],
  });
}

async function buildWebAssets(icons, solidIcons = []) {
  await rm(webIconsDir, { recursive: true, force: true });
  await rm(webSolidIconsDir, { recursive: true, force: true });
  await mkdir(webIconsDir, { recursive: true });
  await mkdir(webSolidIconsDir, { recursive: true });
  for (const icon of icons) {
    await copyFile(
      path.join(iconsDir, icon.fileName),
      path.join(webIconsDir, icon.fileName),
    );
  }
  for (const icon of solidIcons) {
    await copyFile(
      path.join(solidIconsDir, icon.fileName),
      path.join(webSolidIconsDir, icon.fileName),
    );
  }
  // The homepage's Outline/Solid toggle fetches the solid path data on first
  // use, so the solid set never weighs down the page.
  await writeFile(
    path.join(webSolidIconsDir, "index.json"),
    JSON.stringify(Object.fromEntries(solidIcons.map((icon) => [icon.name, icon.iconNode.map(([, attrs]) => attrs.d)]))),
  );
  // The homepage fetches this lazily so tags never weigh down its HTML.
  await writeFile(
    path.join(webIconsDir, "index.json"),
    JSON.stringify({
      categories: Object.fromEntries(iconCategories.map(({ id, title }) => [id, title])),
      icons: icons.map((icon) => [icon.name, icon.tags, icon.categories.join(" ")]),
    }),
  );
}

export async function buildPreview() {
  const icons = await readIcons();
  // A fixed column count keeps the width readable in README columns as the set grows.
  const columns = 30;
  const cell = 32;
  const padding = 32;
  const gap = 24;
  const scale = 2;
  const strokeWidth = 2.25;
  const rows = Math.max(1, Math.ceil(icons.length / columns));
  const width = padding * 2 + columns * cell + (columns - 1) * gap;
  const height = padding * 2 + rows * cell + (rows - 1) * gap;
  const tiles = icons
    .map((icon, i) => {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const x = padding + col * (cell + gap);
      const y = padding + row * (cell + gap);
      const inner = icon.svg
        .replace(/^[\s\S]*?<svg\b[^>]*>/, "")
        .replace(/<\/svg>\s*$/, "")
        .trim();
      return `<g transform="translate(${x} ${y}) scale(${cell / 24})">${inner}</g>`;
    })
    .join("");
  const composite = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" stroke="#000000" stroke-width="${(strokeWidth * 24) / cell}" stroke-linecap="round" stroke-linejoin="round"><rect width="${width}" height="${height}" fill="#ffffff" stroke="none"/>${tiles}</svg>`;
  const png = new Resvg(composite, {
    fitTo: { mode: "width", value: width * scale },
    background: "#ffffff",
  })
    .render()
    .asPng();
  await mkdir(path.dirname(previewPath), { recursive: true });
  await writeFile(previewPath, png);
  console.log(
    `Wrote ${path.relative(root, previewPath)} (${icons.length} icons, ${columns}x${rows}, ${width * scale}x${height * scale}).`,
  );
}

function fnv1aHash(value) {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < value.length; i++) {
    hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleUnique(items, random) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export async function buildOg() {
  const icons = await readIcons();
  if (icons.length === 0) throw new Error("buildOg: no icons available");

  const width = 1200;
  const height = 630;
  const targetIconSize = 40;
  const targetGap = 24;
  const targetStep = targetIconSize + targetGap;
  const angle = -22;

  const innerSvgs = icons.map((icon) =>
    icon.svg
      .replace(/^[\s\S]*?<svg\b[^>]*>/, "")
      .replace(/<\/svg>\s*$/, "")
      .trim(),
  );

  const seed = fnv1aHash(icons.map((icon) => icon.name).join(","));
  const random = mulberry32(seed);

  // Match the grid to the rotated canvas bounds so more unique icons remain
  // visible instead of being cropped out by an oversized square grid.
  const radians = (Math.abs(angle) * Math.PI) / 180;
  const coverWidth =
    Math.ceil(width * Math.cos(radians) + height * Math.sin(radians)) +
    targetStep * 2;
  const coverHeight =
    Math.ceil(width * Math.sin(radians) + height * Math.cos(radians)) +
    targetStep * 2;
  const aspect = coverWidth / coverHeight;
  const rows = Math.max(1, Math.ceil(Math.sqrt(icons.length / aspect)));
  const columns = Math.ceil(icons.length / rows);
  const stepX = coverWidth / columns;
  const stepY = coverHeight / rows;
  const iconSize = Math.min(stepX, stepY) * (targetIconSize / targetStep);
  const offsetX = -coverWidth / 2;
  const offsetY = -coverHeight / 2;
  const scale = iconSize / 24;
  const positions = Array.from({ length: rows * columns }, (_, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    return {
      index,
      x: offsetX + col * stepX,
      y: offsetY + row * stepY,
      distance: Math.hypot(col - (columns - 1) / 2, row - (rows - 1) / 2),
    };
  });
  const skippedPositions = new Set(
    [...positions]
      .sort((a, b) => b.distance - a.distance || b.index - a.index)
      .slice(0, positions.length - icons.length)
      .map((position) => position.index),
  );
  const visiblePositions = positions.filter(
    (position) => !skippedPositions.has(position.index),
  );
  const uniqueSvgs = shuffleUnique(innerSvgs, random);
  const tiles = visiblePositions.map(
    ({ x, y }, index) =>
      `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(4)})">${uniqueSvgs[index]}</g>`,
  );

  const composite = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" stroke-linecap="round" stroke-linejoin="round">
<rect width="${width}" height="${height}" fill="#ffffff"/>
<g transform="translate(${width / 2} ${height / 2}) rotate(${angle})" stroke="#111111" stroke-width="1.5">${tiles.join("")}</g>
</svg>`;

  const png = new Resvg(composite, {
    fitTo: { mode: "width", value: width },
    background: "#ffffff",
  })
    .render()
    .asPng();
  await mkdir(path.dirname(ogPath), { recursive: true });
  await writeFile(ogPath, png);
  console.log(
    `Wrote ${path.relative(root, ogPath)} (${icons.length} unique icons, ${tiles.length} tiles, ${width}x${height}).`,
  );
}

export async function build() {
  const icons = await readIcons();
  const solidIcons = await readIcons(styles.solid);
  validateStyleTwins({ outline: icons.map((icon) => icon.name), solid: solidIcons.map((icon) => icon.name) });
  await assertIconNodesPassRuntimePolicy([...icons, ...solidIcons]);
  await synchronizeDocCounts(icons.map((icon) => icon.name));
  await buildRawPackage(icons, solidIcons);
  await buildReactPackage(icons, reactDist, solidIcons);
  await buildReactNativePackage(icons, reactNativeDist, solidIcons);
  await buildVuePackage(icons, vueDist, solidIcons);
  await buildSveltePackage(icons, svelteDist, solidIcons);
  await buildSolidPackage(icons, solidDist, solidIcons);
  await buildAngularPackage(icons, angularPackage, root, solidIcons);
  await buildAstroPackage(icons, astroDist, solidIcons);
  await buildPreactPackage(icons, preactDist, solidIcons);
  await buildLitPackage(icons, litDist, solidIcons);
  await buildQwikPackage(icons, qwikDist, solidIcons);
  await buildFlutterPackage(icons, flutterPackage, solidIcons);
  await buildComposePackage(icons, composePackage, solidIcons);
  await buildMcpPackage(icons, iconCategories, { packageDirectory: mcpPackage, root, solidIcons });
  await buildWebAssets(icons, solidIcons);
  await buildShadcnRegistry(icons, shadcnRegistryDir, { solidIcons });
  console.log(`Built packages and web assets for ${icons.length} icons.`);
}

export async function allocateCodepoints() {
  await allocateFontCodepoints(await readIcons(), fontCodepointsPath);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  if (command === "optimize") await optimizeIcons();
  else if (command === "check") await checkIcons();
  else if (command === "build") await build();
  else if (command === "font-codepoints") await allocateCodepoints();
  else if (command === "preview") await buildPreview();
  else if (command === "og") await buildOg();
  else {
    console.error(
      "Usage: bun scripts/icons.mjs <optimize|check|build|font-codepoints|preview|og>",
    );
    process.exit(1);
  }
}
