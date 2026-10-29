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

// Built pages use literal UTF-8 and only these named entities. Any other
// named entity fails loudly rather than slipping past the checks as ASCII.
const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0" };
const decode = (text) =>
  text.replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-z][a-z0-9]*));/gi, (match, hex, decimal, name) => {
    if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
    if (decimal) return String.fromCodePoint(Number(decimal));
    if (name in entities) return entities[name];
    throw new Error(`Unknown HTML entity ${match}: add it to decode() in tests/docs-fonts.test.mjs`);
  });

// The rendered text nodes and placeholders of a page, outside scripts and styles.
const textNodes = (html) => {
  const texts = [];
  let current = "";
  let skipping = 0;
  new HTMLRewriter()
    .on("script, style", {
      element(element) {
        skipping++;
        element.onEndTag(() => {
          skipping--;
        });
      },
    })
    .on("[placeholder]", {
      element(element) {
        texts.push(decode(element.getAttribute("placeholder")));
      },
    })
    .onDocument({
      text(chunk) {
        if (skipping) return;
        current += chunk.text;
        if (chunk.lastInTextNode) {
          texts.push(decode(current));
          current = "";
        }
      },
    })
    .transform(html);
  return texts;
};

describe("docs fonts", () => {
  const pages = htmlFiles(clientDir);
  const home = readFileSync(path.join(clientDir, "index.html"), "utf8");

  test("entity decoding is single-pass and refuses unknown names", () => {
    expect(textNodes("<p>caf&#233; &#x2014; &amp;eacute; &#38;eacute;</p>")).toEqual(["café — &eacute; &eacute;"]);
    expect(() => textNodes("<p>caf&eacute;</p>")).toThrow("Unknown HTML entity &eacute;");
  });

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
    const texts = pages.flatMap((page) => textNodes(readFileSync(page, "utf8")));
    const failures = new Set();
    for (const family of manifest.families) {
      const missing = new Set(parseRange(family.missing));
      const covered = new Set(parseRange(family.faces.flatMap((face) => face.unicodeRange)));
      const core = new Set(family.faces.filter((face) => face.subset === "latin").flatMap((face) => parseRange(face.unicodeRange)));
      for (const text of texts) {
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
    expect([...failures], rerun).toEqual([]);
  });
});
