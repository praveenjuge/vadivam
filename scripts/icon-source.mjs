// Reads and validates the canonical icon source: icons/, icons-solid/, and
// the Lucide metadata in metadata/. `validateSvgContent` is the source of
// truth for what an icon file may contain.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { elementPathData, inkBounds, parsePath, shortStrokeEnds } from "./icon-geometry.mjs";
import { findUnsmoothedCorners } from "./corner-smoothing.mjs";
import { cleanPaths, gridTolerance } from "./path-cleanup.mjs";
import { canvasSize, geometryAttributes, iconNamePattern, pascalCase, rootAttributes, styles } from "./icon-styles.mjs";
import { metadataFiles, root } from "./lib/paths.mjs";

export { root, styles };

/** Data files the build reads here, for scripts/release-changes.mjs. */
export const buildInputs = [metadataFiles.lucide, metadataFiles.aliases, metadataFiles.rankings];

const readJson = async (relativePath) => JSON.parse(await readFile(path.join(root, relativePath), "utf8"));

export const lucideMetadata = await readJson(metadataFiles.lucide);
export const lucideVersion = lucideMetadata.lucideVersion;

export const iconCategories = Object.entries(lucideMetadata.categories).map(
  ([id, { title, description }]) => ({ id, title, ...(description && { description }) }),
);

export function sourceDirectory(style) {
  return path.join(root, style.sourceDirectory);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function validateIconName(name, file = `${name}.svg`) {
  assert(iconNamePattern.test(name), `${file}: icon filename must use lowercase kebab-case`);
}

/** Names of the SVG files in a style's folder, sorted. */
export async function iconNames(style = styles.outline) {
  return (await readdir(sourceDirectory(style)))
    .filter((file) => file.endsWith(".svg"))
    .sort()
    .map((file) => file.slice(0, -".svg".length));
}

// Tags and categories come from Lucide's metadata for the pinned release, so
// each icon's search terms match the canonical name it is drawn for. The
// metadata only has entries for canonical names, so an entry for every icon
// also means every file name is canonical.
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

/** Lucide's icons ranked by popularity, for the release the file was written for. */
export function lucideRankings() {
  return readJson(metadataFiles.rankings);
}

/**
 * Every Lucide-derived file is for the release metadata/lucide.json pins, and
 * every icon has a canonical name in that release. The rankings list every
 * canonical name, so a deprecated name fails here even if its metadata entry
 * was renamed with it.
 */
export async function validateLucidePins(names, { rankings, docs } = {}) {
  rankings ??= await lucideRankings();
  assert(
    rankings.lucideVersion === lucideVersion,
    `${metadataFiles.rankings} is for Lucide ${rankings.lucideVersion}, not the pinned ${lucideVersion}; run bun run icons:rankings`,
  );
  const canonical = new Set(rankings.icons.map(({ name }) => name));
  const unknown = names.filter((name) => !canonical.has(name));
  assert(
    unknown.length === 0,
    `Deprecated or non-canonical icon names for Lucide ${lucideVersion}: ${unknown.join(", ")}. Rename them to current canonical Lucide names`,
  );
  docs ??= await readJson("apps/docs/package.json");
  const docsLucide = docs.dependencies?.lucide ?? docs.devDependencies?.lucide;
  assert(
    docsLucide === lucideVersion,
    `apps/docs/package.json pins lucide ${docsLucide}, not the pinned ${lucideVersion}`,
  );
}

/**
 * Deprecated Lucide names that point at a drawn icon and are not icons
 * themselves. Read on each call, so watch-mode rebuilds see alias edits.
 */
export async function lucideAliasesFor(names) {
  const drawn = new Set(names);
  return Object.fromEntries(
    Object.entries(await readJson(metadataFiles.aliases)).filter(([alias, name]) => !drawn.has(alias) && drawn.has(name)),
  );
}

// Every icon is drawn in every style, under the same name.
export function validateStyleTwins(namesByStyle) {
  const [[firstStyle, expected], ...others] = Object.entries(namesByStyle);
  const expectedSet = new Set(expected);
  const list = (names) => `${names.slice(0, 10).join(", ")}${names.length > 10 ? ", …" : ""}`;
  for (const [style, names] of others) {
    const set = new Set(names);
    const missing = expected.filter((name) => !set.has(name));
    const extra = names.filter((name) => !expectedSet.has(name));
    assert(missing.length === 0, `${style} is missing ${missing.length} icon(s) drawn in ${firstStyle}: ${list(missing)}`);
    assert(extra.length === 0, `${style} has ${extra.length} icon(s) with no ${firstStyle} twin: ${list(extra)}`);
  }
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", trimValues: true });

export function parseSvg(svg, file = "inline.svg") {
  const xmlCheck = XMLValidator.validate(svg);
  assert(xmlCheck === true, `${file}: invalid XML ${JSON.stringify(xmlCheck)}`);
  const parsed = parser.parse(svg);
  assert(parsed.svg && typeof parsed.svg === "object", `${file}: missing <svg> root`);
  return parsed.svg;
}

export function asArray(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

const attributes = (node) => Object.keys(node).filter((key) => key.startsWith("@_")).map((key) => key.slice(2));
const children = (node) => Object.entries(node).filter(([key]) => !key.startsWith("@_"));

const maxClosedSubpathsPerPath = 8;
// A closepath followed straight by a drawing command, with no move to start the next subpath.
export const subpathWithoutMove = /([zZ])\s*(?=[a-ln-yA-LN-Y])/g;

export function validateSvgContent(svg, file = "inline.svg", style = styles.outline) {
  const node = parseSvg(svg, file);
  const expectedRoot = rootAttributes(style);
  for (const [attr, value] of Object.entries(expectedRoot)) {
    assert(node[`@_${attr}`] === String(value), `${file}: expected ${attr}="${value}"`);
  }
  for (const attr of attributes(node)) {
    assert(attr in expectedRoot, `${file}: unsupported root attribute ${attr}`);
  }

  const shapes = [];
  for (const [tag, value] of children(node)) {
    const allowed = Object.hasOwn(geometryAttributes, tag) ? geometryAttributes[tag] : undefined;
    assert(allowed, `${file}: unsupported <${tag}> element`);
    for (const item of asArray(value)) {
      assert(item && typeof item === "object", `${file}: invalid <${tag}> element`);
      for (const [child] of children(item)) {
        assert(false, `${file}: unsupported <${child}> element`);
      }
      for (const attr of attributes(item)) {
        assert(allowed.includes(attr), `${file}: unsupported ${tag} attribute ${attr}`);
      }
      const geometry = Object.fromEntries(attributes(item).map((attr) => [attr, item[`@_${attr}`]]));
      assert(Object.keys(geometry).length > 0, `${file}: <${tag}> has no geometry`);
      if (tag === "path") {
        const closedSubpaths = (geometry.d?.match(/z/gi) ?? []).length;
        assert(
          !style.stroked || closedSubpaths <= maxClosedSubpathsPerPath,
          `${file}: path has ${closedSubpaths} closed subpaths and looks like expanded stroke geometry; use open centerline strokes`,
        );
        assertSmoothCorners(geometry.d, file);
      }
      assert(
        tag !== "rect" || (geometry.rx === undefined && geometry.ry === undefined),
        `${file}: <rect> corners cannot carry corner smoothing; draw rounded rectangles as paths`,
      );
      shapes.push([tag, geometry]);
    }
  }

  assert(shapes.length > 0, `${file}: no drawable elements found`);
  assertInkInsidePadding(shapes, file, style);
  const paths = shapes.filter(([tag]) => tag === "path").map(([, attrs]) => attrs.d);
  const unmoved = paths.filter((d) => d.search(subpathWithoutMove) >= 0).length;
  assert(unmoved === 0, `${file}: ${unmoved} path(s) start a subpath after "z" without a move; WebKit draws it from the wrong point, so add "m0 0" after the "z"`);
  // Flutter and Compose join every shape into one even-odd path, so two
  // overlapping solid shapes would cancel out there; draw one path instead.
  assert(
    style.stroked || (shapes.length === 1 && shapes[0][0] === "path"),
    `${file}: a solid icon must be a single <path>; unite overlapping shapes into one path`,
  );
  // Path cleanup joins and trims strokes, which only applies to outlines.
  if (style.stroked) {
    assertCleanPaths(paths, file);
    assertStrokesMeet(shapes.map(([tag, attrs]) => elementPathData(tag, attrs)), file);
  }
}

const format = (value, digits = 3) => Number(value.toFixed(digits));

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
  assert(
    corners.length === 0,
    `${file}: ${corners.length} rounded corner(s) use a plain circular arc (first near ${format(corners[0]?.x ?? 0)}, ${format(corners[0]?.y ?? 0)}); run bun run icons:optimize to apply 60% corner smoothing`,
  );
}

// With round caps and joins the 2px stroke reaches 1px past the centerline, so
// keeping the ink inside the 1px padding keeps every point of the geometry at
// least 2px inside the canvas edge. Solid shapes are their own ink.
function assertInkInsidePadding(shapes, file, style) {
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
  const epsilon = style.stroked ? 0.01 : 0.05;
  const inside =
    box.minX >= padding - epsilon &&
    box.minY >= padding - epsilon &&
    box.maxX <= canvasSize - padding + epsilon &&
    box.maxY <= canvasSize - padding + epsilon;
  const span = `x ${format(box.minX)} to ${format(box.maxX)}, y ${format(box.minY)} to ${format(box.maxY)}`;
  assert(
    inside,
    style.stroked
      ? `${file}: stroke reaches into the ${padding}px padding (ink spans ${span}); keep geometry at least ${padding + style.inkWidth / 2}px from every edge`
      : `${file}: shape reaches into the ${padding}px padding (ink spans ${span}); keep the shape at least ${padding}px from every edge`,
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
  assert(problems.length === 0, `${file}: ${problems.join(", ")}; run bun run icons:optimize to clean the path data`);
}

// A stroke that stops just short of another overlaps it without meeting it.
function assertStrokesMeet(paths, file) {
  const ends = shortStrokeEnds(paths.flatMap((d) => parsePath(d)));
  assert(
    ends.length === 0,
    `${file}: ${ends.length} stroke end(s) stop short of another stroke (first ${format(ends[0]?.distance ?? 0, 2)}px short near ${format(ends[0]?.point[0] ?? 0, 2)}, ${format(ends[0]?.point[1] ?? 0, 2)}); join them, or leave a gap of at least 1.5px`,
  );
}

function iconNodeFromSvg(svg, file) {
  const node = parseSvg(svg, file);
  const iconNode = [];
  for (const [tag, allowed] of Object.entries(geometryAttributes)) {
    for (const item of asArray(node[tag])) {
      const attrs = Object.fromEntries(allowed.filter((attr) => `@_${attr}` in item).map((attr) => [attr, item[`@_${attr}`]]));
      iconNode.push([tag, attrs]);
    }
  }
  return iconNode;
}

/** Every icon of a style, validated, with its metadata and icon node. */
export async function readIcons(style = styles.outline) {
  const icons = [];
  for (const name of await iconNames(style)) {
    const fileName = `${name}.svg`;
    validateIconName(name, fileName);
    const svg = await readFile(path.join(sourceDirectory(style), fileName), "utf8");
    validateSvgContent(svg, fileName, style);
    icons.push({
      name,
      componentName: pascalCase(name),
      fileName,
      svgPath: `${style.sourceDirectory}/${fileName}`,
      tags: lucideMetadata.icons[name]?.tags ?? [],
      categories: lucideMetadata.icons[name]?.categories ?? [],
      svg,
      iconNode: iconNodeFromSvg(svg, fileName),
    });
  }
  validateIconMetadata(icons.map((icon) => icon.name));
  return icons;
}
