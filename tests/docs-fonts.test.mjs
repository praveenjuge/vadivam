import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fontsDir = path.join(root, "apps", "docs", "fonts");
const clientDir = path.join(root, "apps", "docs", "dist", "client");
const manifest = JSON.parse(readFileSync(path.join(fontsDir, "fonts.json"), "utf8"));
const rerun = "Rerun `bun run fonts:subset` (see scripts/subset-fonts.py) and commit apps/docs/fonts.";

const htmlFiles = (dir) =>
  readdirSync(dir, { recursive: true })
    .filter((file) => file.endsWith(".html"))
    .map((file) => path.join(dir, file));

const parseRange = (ranges) =>
  ranges.flatMap((range) => {
    const [start, end = start] = range.slice(2).split("-").map((hex) => Number.parseInt(hex, 16));
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  });

// Built font URLs are content hashes, so match them to the committed files by bytes.
const committedByContent = new Map(
  readdirSync(fontsDir)
    .filter((file) => file.endsWith(".woff2"))
    .map((file) => [readFileSync(path.join(fontsDir, file)).toString("base64"), file])
);
const committedFile = (url) =>
  committedByContent.get(readFileSync(path.join(clientDir, url)).toString("base64"));

const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (text) =>
  text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&([a-z]+);/gi, (match, name) => entities[name] ?? match);

describe("docs fonts", () => {
  const pages = htmlFiles(clientDir);
  const home = readFileSync(path.join(clientDir, "index.html"), "utf8");

  test("pages preload only core files", () => {
    for (const page of pages) {
      const html = readFileSync(page, "utf8");
      const preloads = [...html.matchAll(/<link rel="preload" href="([^"]+)" as="font"/g)].map(
        ([, url]) => committedFile(url)
      );
      expect(preloads, page).toEqual(["sn-pro-core.woff2", "vadivam-mono-core.woff2"]);
    }
  });

  test("each @font-face declares exactly its file's characters", () => {
    const faces = [...home.matchAll(/@font-face\{[^}]*src:url\("([^"]+)"\)[^}]*unicode-range:([^;]+);[^}]*font-weight:(\d+);font-style:(\w+);\}/g)];
    const expected = manifest.families.flatMap((family) =>
      family.faces.flatMap((face) => face.weights.map((weight) => [face.src, face.unicodeRange.join(","), weight, face.style]))
    );
    const declared = faces.map(([, url, range, weight, style]) => [committedFile(url), range, Number(weight), style]);
    expect(declared.toSorted()).toEqual(expected.toSorted());
  });

  test("fonts cover what the pages use, and keep in-word characters in the core", () => {
    const eligible = new Set(parseRange(manifest.eligible));
    const failures = new Set();
    for (const family of manifest.families) {
      const missing = new Set(parseRange(family.missing));
      const covered = new Set(parseRange(family.faces.flatMap((face) => face.unicodeRange)));
      const core = new Set(family.faces.filter((face) => face.subset === "latin").flatMap((face) => parseRange(face.unicodeRange)));
      for (const page of pages) {
        const html = readFileSync(page, "utf8").replace(/<(script|style)\b[\s\S]*?<\/\1>|<!--[\s\S]*?-->/g, "");
        const texts = [...html.split(/<[^>]*>/), ...[...html.matchAll(/placeholder="([^"]*)"/g)].map(([, text]) => text)];
        for (const text of texts.map(decode)) {
          const chars = [...text];
          chars.forEach((char, index) => {
            const code = char.codePointAt(0);
            if (!eligible.has(code) || missing.has(code)) return;
            if (!covered.has(code)) failures.add(`${family.name} lacks U+${code.toString(16).toUpperCase()} (${char})`);
            const inWord = /\p{M}/u.test(char) || `${chars[index - 1] ?? ""}${chars[index + 1] ?? ""}`.trim();
            if (inWord && !core.has(code)) failures.add(`${family.name} serves U+${code.toString(16).toUpperCase()} (${char}), used inside a word, from the extended file`);
          });
        }
      }
    }
    expect([...failures], rerun).toEqual([]);
  });
});
