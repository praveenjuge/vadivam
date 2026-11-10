import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import { openSync } from "fontkit";
import { icons as manifest } from "vadivam/manifest";
import { asArray, root, validateIconName } from "../scripts/icon-source.mjs";
import { canvasAttributes, packagePath, styles, svgElementTypes } from "../scripts/icon-styles.mjs";
import {
  allocateFontCodepoints,
  buildStaticAssets,
  fontCacheKey,
  fontCodepointsPath,
  privateUseEnd,
  privateUseStart,
  readFontCodepoints,
  validateFontCodepoints,
} from "../scripts/generators/static.mjs";

const packageRoot = path.join(root, "packages/vadivam");
const packageDist = path.join(packageRoot, "dist");
const registry = await readFontCodepoints(fontCodepointsPath);
const currentNames = new Set(manifest.map(({ name }) => name));
const retiredNames = Object.keys(registry).filter((name) => !currentNames.has(name));

/** The `<symbol>` elements of a sprite, by id. */
async function spriteSymbols(style) {
  const sprite = await readFile(path.join(packageRoot, packagePath(style, "sprite.svg")), "utf8");
  expect(sprite).not.toMatch(/<(?:script|style|foreignObject|image|use)\b/i);
  const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" }).parse(sprite);
  return new Map(asArray(parsed.svg.symbol).map((symbol) => [symbol["@_id"], symbol]));
}

/** The codepoint each `::before` rule in a font stylesheet draws, by icon name. */
function cssCodepoints(css) {
  return Object.fromEntries(
    [...css.matchAll(/\.vadivam-icon-([a-z0-9-]+)::before\s*\{\s*content:\s*"\\([0-9a-f]+)"/g)].map(([, name, hex]) => [
      name,
      Number.parseInt(hex, 16),
    ]),
  );
}

const expectedCodepoints = Object.fromEntries(manifest.map(({ name }) => [name, registry[name]]));

describe("static SVG assets", () => {
  test("exports every canonical SVG as an exact string", async () => {
    for (const icon of manifest) {
      const module = await import(`vadivam/strings/${icon.name}`);
      expect(module.default).toBe(icon.svg);
    }
  });

  test("resolves static exports through Node ESM", () => {
    const script = `
      import activity from "vadivam/strings/activity";
      console.log(JSON.stringify({
        activity,
        sprite: import.meta.resolve("vadivam/sprite.svg"),
        css: import.meta.resolve("vadivam/font/vadivam.css"),
        font: import.meta.resolve("vadivam/font/vadivam.woff2"),
      }));
    `;
    const result = spawnSync("node", ["--input-type=module", "--eval", script], { cwd: root, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    const resolved = JSON.parse(result.stdout);
    expect(resolved.activity).toBe(manifest.find(({ name }) => name === "activity").svg);
    expect(resolved.sprite).toEndWith("/packages/vadivam/dist/sprite.svg");
    expect(resolved.css).toEndWith("/packages/vadivam/dist/font/vadivam.css");
    expect(resolved.font).toEndWith("/packages/vadivam/dist/font/vadivam.woff2");
  });

  test("builds a complete, safe sprite with matching geometry", async () => {
    const symbols = await spriteSymbols(styles.outline);
    expect(symbols.size).toBe(manifest.length);
    for (const icon of manifest) {
      const symbol = symbols.get(`${styles.outline.spriteIdPrefix}${icon.name}`);
      expect(symbol?.["@_viewBox"]).toBe(canvasAttributes.viewBox);
      const geometryCount = svgElementTypes.reduce((count, tag) => count + asArray(symbol?.[tag]).length, 0);
      expect(geometryCount).toBe(icon.iconNode.length);
    }
  });

  test("rejects icon names that are unsafe in paths, CSS, or IDs", () => {
    expect(() => validateIconName("activity")).not.toThrow();
    for (const name of ["Activity", "../activity", "activity icon", 'activity"']) {
      expect(() => validateIconName(name)).toThrow("lowercase kebab-case");
    }
  });
});

describe("font codepoints", () => {
  test("covers every icon and preserves retired codepoint reservations", () => {
    expect(() => validateFontCodepoints(manifest, registry)).not.toThrow();
    const current = Object.values(expectedCodepoints);
    expect(new Set(current).size).toBe(manifest.length);
    expect(retiredNames).toContain("history");
    expect(current).not.toContain(registry.history);
    expect(Math.min(...current)).toBeGreaterThanOrEqual(privateUseStart);
    expect(Math.max(...current)).toBeLessThanOrEqual(privateUseEnd);
  });

  test("fails clearly for missing, duplicate, and invalid codepoints", () => {
    expect(() => validateFontCodepoints([{ name: "activity" }], {})).toThrow("icons:font-codepoints");
    expect(() =>
      validateFontCodepoints([{ name: "activity" }], { activity: privateUseStart, search: privateUseStart }),
    ).toThrow("already allocated");
    expect(() => validateFontCodepoints([{ name: "activity" }], { activity: 65 })).toThrow("Private Use Area");
  });

  test("appends new allocations without reusing reserved entries", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "vadivam-codepoints-"));
    const fixturePath = path.join(directory, "codepoints.json");
    try {
      await writeFile(fixturePath, `${JSON.stringify({ activity: privateUseStart, removed: privateUseStart + 2 })}\n`);
      await allocateFontCodepoints([{ name: "activity" }, { name: "search" }], fixturePath);
      expect(await readFontCodepoints(fixturePath)).toEqual({
        activity: privateUseStart,
        removed: privateUseStart + 2,
        search: privateUseStart + 3,
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("uses a deterministic cache key that covers SVG and codepoint changes", async () => {
    const baseline = await fontCacheKey(manifest, registry, root);
    expect(await fontCacheKey(manifest, registry, root)).toBe(baseline);
    expect(
      await fontCacheKey([{ ...manifest[0], svg: `${manifest[0].svg} ` }, ...manifest.slice(1)], registry, root),
    ).not.toBe(baseline);
    expect(await fontCacheKey(manifest, { ...registry, [manifest[0].name]: privateUseEnd }, root)).not.toBe(baseline);
  });
});

describe("WOFF2 font", () => {
  test("rebuilds every static asset deterministically", async () => {
    // Rebuild into a scratch folder, so the shared dist other tests read stays put.
    const outputDirectory = await mkdtemp(path.join(tmpdir(), "vadivam-static-"));
    try {
      await buildStaticAssets(manifest, { iconsDirectory: path.join(root, "icons"), outputDirectory });
      for (const asset of ["sprite.svg", "font/vadivam.css", "font/vadivam.woff2", "strings/activity.js"]) {
        expect(await readFile(path.join(outputDirectory, asset))).toEqual(await readFile(path.join(packageDist, asset)));
      }
    } finally {
      await rm(outputDirectory, { recursive: true, force: true });
    }
  });

  test("contains one addressable glyph for every icon", async () => {
    const fontPath = path.join(packageDist, "font/vadivam.woff2");
    expect((await readFile(fontPath)).subarray(0, 4).toString()).toBe("wOF2");
    const font = openSync(fontPath);
    expect(font.familyName).toBe(styles.outline.font.fontFamily);
    const glyphGeometries = new Map();
    for (const icon of manifest) {
      const glyphId = font.glyphForCodePoint(registry[icon.name]).id;
      expect(glyphId).toBeGreaterThan(0);
      const geometry = JSON.stringify(
        icon.iconNode
          .map(([tag, attrs]) => [tag, Object.fromEntries(Object.entries(attrs).filter(([name]) => name !== "key"))])
          .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
      );
      expect(glyphGeometries.get(glyphId) ?? geometry).toBe(geometry);
      glyphGeometries.set(glyphId, geometry);
    }
    for (const name of retiredNames) expect(font.glyphForCodePoint(registry[name]).id).toBe(0);
    expect(font.numGlyphs).toBe(glyphGeometries.size + 1);
  });

  test("ships complete CSS and no legacy font formats", async () => {
    const fontDirectory = path.join(packageDist, "font");
    const css = await readFile(path.join(fontDirectory, "vadivam.css"), "utf8");
    expect(css).toContain('url("./vadivam.woff2") format("woff2")');
    expect(css).toContain(`font-family: "${styles.outline.font.fontFamily}"`);
    // Every current icon draws its registered codepoint; retired ones have no rule.
    expect(cssCodepoints(css)).toEqual(expectedCodepoints);
    expect((await readdir(fontDirectory)).sort()).toEqual([
      "vadivam-solid.css",
      "vadivam-solid.woff2",
      "vadivam.css",
      "vadivam.woff2",
    ]);
  });

  test("ships a solid font on the same codepoints", async () => {
    const fontDirectory = path.join(packageDist, "font");
    const { font: solidFont } = styles.solid;
    const css = await readFile(path.join(fontDirectory, "vadivam-solid.css"), "utf8");
    expect(css).toContain('url("./vadivam-solid.woff2") format("woff2")');
    expect(css).toContain(`font-family: "${solidFont.fontFamily}"`);
    expect(css).toContain(`.${solidFont.baseClass} {`);
    expect(cssCodepoints(css)).toEqual(expectedCodepoints);
    const font = openSync(path.join(fontDirectory, "vadivam-solid.woff2"));
    expect(font.familyName).toBe(solidFont.fontFamily);
    for (const icon of manifest) {
      expect(font.glyphForCodePoint(registry[icon.name]).id).toBeGreaterThan(0);
    }
  });
});

describe("solid static assets", () => {
  test("exports every solid SVG as a string and a sprite symbol", async () => {
    const symbols = await spriteSymbols(styles.solid);
    expect(symbols.size).toBe(manifest.length);
    for (const icon of manifest) {
      const module = await import(`vadivam/solid/strings/${icon.name}`);
      expect(module.default).toBe(icon.solid.svg);
      expect(symbols.get(`${styles.solid.spriteIdPrefix}${icon.name}`)?.["@_viewBox"]).toBe(canvasAttributes.viewBox);
      // svgPath points at the SVG the package ships.
      expect(await readFile(path.join(packageDist, icon.solid.svgPath), "utf8")).toBe(icon.solid.svg);
    }
  });
});
