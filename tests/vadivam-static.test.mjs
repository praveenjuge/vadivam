import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser } from "fast-xml-parser";
import { openSync } from "fontkit";
import { icons as manifest } from "vadivam/manifest";
import { validateIconName } from "../scripts/icons.mjs";
import {
  allocateFontCodepoints,
  buildStaticAssets,
  fontCacheKey,
  privateUseEnd,
  privateUseStart,
  readFontCodepoints,
  validateFontCodepoints,
} from "../scripts/generators/static.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageDist = path.join(root, "packages/vadivam/dist");
const registryPath = path.join(root, "scripts/font-codepoints.json");
const graphics = ["path", "circle", "line", "polyline", "polygon", "rect", "ellipse"];

function asArray(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

describe("static SVG assets", () => {
  test("exports every canonical SVG as an exact string", async () => {
    for (const icon of manifest) {
      const module = await import(`vadivam/strings/${icon.name}`);
      expect(module.default).toBe(icon.svg);
      expect(import.meta.resolve(`vadivam/strings/${icon.name}`)).toEndWith(
        `/packages/vadivam/dist/strings/${icon.name}.js`,
      );
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
    const result = spawnSync("node", [
      "--input-type=module",
      "--eval",
      script,
    ], {
      cwd: root,
      encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(0);
    const resolved = JSON.parse(result.stdout);
    expect(resolved.activity).toBe(
      manifest.find(({ name }) => name === "activity").svg,
    );
    expect(resolved.sprite).toEndWith("/packages/vadivam/dist/sprite.svg");
    expect(resolved.css).toEndWith("/packages/vadivam/dist/font/vadivam.css");
    expect(resolved.font).toEndWith("/packages/vadivam/dist/font/vadivam.woff2");
  });

  test("builds a complete, safe sprite with matching geometry", async () => {
    const sprite = await readFile(path.join(packageDist, "sprite.svg"), "utf8");
    const parsed = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    }).parse(sprite);
    const symbols = asArray(parsed.svg.symbol);
    expect(symbols).toHaveLength(manifest.length);
    expect(new Set(symbols.map((symbol) => symbol["@_id"])).size).toBe(manifest.length);
    expect(sprite).not.toMatch(/<(?:script|style|foreignObject|image|use)\b/i);

    for (const icon of manifest) {
      const symbol = symbols.find(
        (candidate) => candidate["@_id"] === `vadivam-${icon.name}`,
      );
      expect(symbol?.["@_viewBox"]).toBe("0 0 24 24");
      const geometryCount = graphics.reduce(
        (count, tag) => count + asArray(symbol?.[tag]).length,
        0,
      );
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
  test("covers every icon with a unique private-use codepoint", async () => {
    const registry = await readFontCodepoints(registryPath);
    expect(() => validateFontCodepoints(manifest, registry)).not.toThrow();
    const current = manifest.map(({ name }) => registry[name]);
    expect(new Set(current).size).toBe(manifest.length);
    expect(Math.min(...current)).toBeGreaterThanOrEqual(privateUseStart);
    expect(Math.max(...current)).toBeLessThanOrEqual(privateUseEnd);
  });

  test("fails clearly for missing, duplicate, and invalid codepoints", () => {
    expect(() => validateFontCodepoints([{ name: "activity" }], {})).toThrow(
      "icons:font-codepoints",
    );
    expect(() =>
      validateFontCodepoints(
        [{ name: "activity" }],
        { activity: privateUseStart, search: privateUseStart },
      ),
    ).toThrow("already allocated");
    expect(() =>
      validateFontCodepoints([{ name: "activity" }], { activity: 65 }),
    ).toThrow("Private Use Area");
  });

  test("appends new allocations without reusing reserved entries", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "vadivam-codepoints-"));
    const fixturePath = path.join(directory, "codepoints.json");
    try {
      await writeFile(
        fixturePath,
        `${JSON.stringify({ activity: privateUseStart, removed: privateUseStart + 2 })}\n`,
      );
      await allocateFontCodepoints(
        [{ name: "activity" }, { name: "search" }],
        fixturePath,
      );
      const registry = await readFontCodepoints(fixturePath);
      expect(registry).toEqual({
        activity: privateUseStart,
        removed: privateUseStart + 2,
        search: privateUseStart + 3,
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("uses a deterministic cache key that covers SVG and codepoint changes", async () => {
    const registry = await readFontCodepoints(registryPath);
    const baseline = await fontCacheKey(manifest, registry, root);
    expect(await fontCacheKey(manifest, registry, root)).toBe(baseline);
    expect(
      await fontCacheKey(
        [{ ...manifest[0], svg: `${manifest[0].svg} ` }, ...manifest.slice(1)],
        registry,
        root,
      ),
    ).not.toBe(baseline);
    expect(
      await fontCacheKey(manifest, { ...registry, [manifest[0].name]: privateUseEnd }, root),
    ).not.toBe(baseline);
  });
});

describe("WOFF2 font", () => {
  test("rebuilds every static asset deterministically", async () => {
    const paths = ["sprite.svg", "font/vadivam.css", "font/vadivam.woff2"];
    const before = await Promise.all(
      paths.map((asset) => readFile(path.join(packageDist, asset))),
    );
    await buildStaticAssets(manifest, {
      iconsDirectory: path.join(root, "icons"),
      outputDirectory: packageDist,
      registryPath,
      root,
    });
    const after = await Promise.all(
      paths.map((asset) => readFile(path.join(packageDist, asset))),
    );
    expect(after).toEqual(before);
  });

  test("contains one addressable glyph for every icon", async () => {
    const fontPath = path.join(packageDist, "font/vadivam.woff2");
    const contents = await readFile(fontPath);
    expect(contents.subarray(0, 4).toString()).toBe("wOF2");
    const font = openSync(fontPath);
    const registry = await readFontCodepoints(registryPath);
    expect(font.familyName).toBe("Vadivam Icons");
    expect(font.numGlyphs).toBe(manifest.length + 1);
    for (const icon of manifest) {
      expect(font.glyphForCodePoint(registry[icon.name]).id).toBeGreaterThan(0);
    }
  });

  test("ships complete CSS and no legacy font formats", async () => {
    const fontDirectory = path.join(packageDist, "font");
    const css = await readFile(path.join(fontDirectory, "vadivam.css"), "utf8");
    expect(css).toContain('url("./vadivam.woff2") format("woff2")');
    expect(css).toContain('font-family: "Vadivam Icons"');
    expect(css).toContain(String.raw`content: "\e004"`);
    for (const icon of manifest) {
      expect(css).toContain(`.vadivam-icon-${icon.name}::before`);
    }
    expect((await readdir(fontDirectory)).sort()).toEqual([
      "vadivam.css",
      "vadivam.woff2",
    ]);
  });
});
