import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { icons } from "../packages/vadivam/dist/manifest.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "apps/docs/dist");
const site = "https://vadivam.praveenjuge.com";
const readDist = (...segments) => readFileSync(path.join(dist, ...segments), "utf8");

describe("website SEO", () => {
  test.each(["activity", "accessibility"])("%s has one self-canonical URL across metadata", (name) => {
    const html = readDist("icons", name, "index.html");
    const url = `${site}/icons/${name}`;
    expect(html).toContain(`<link href="${url}" rel="canonical">`);
    expect(html).toContain(`<meta content="${url}" property="og:url">`);
    expect(html).toContain(`"url":"${url}"`);
    expect(html).not.toContain(`<link href="${site}" rel="canonical">`);
  });

  test("homepage keeps WebSite identity without obsolete SearchAction markup", () => {
    const html = readDist("index.html");
    expect(html).toContain('"@type":"WebSite"');
    expect(html).not.toContain("SearchAction");
    expect(html).toContain(`${icons.length} free, open-source 24px outline SVG icons`);
    expect(html).toContain('href="/icons/activity"');
  });

  test("sitemap contains exactly the homepage, docs, and canonical icon routes", () => {
    const xml = readDist("sitemap.xml");
    expect(XMLValidator.validate(xml)).toBe(true);
    const parsed = new XMLParser().parse(xml);
    const entries = Array.isArray(parsed.urlset.url) ? parsed.urlset.url : [parsed.urlset.url];
    const locations = entries.map(({ loc }) => loc);
    const docs = readdirSync(path.join(root, "apps/docs/docs"))
      .filter((file) => file.endsWith(".md"))
      .map((file) => (file === "index.md" ? `${site}/docs` : `${site}/docs/${path.basename(file, ".md")}`));
    const expected = [site + "/", ...docs, ...icons.map(({ name }) => `${site}/icons/${name}`)].sort();
    expect(locations).toHaveLength(expected.length);
    expect(new Set(locations).size).toBe(locations.length);
    expect(locations.sort()).toEqual(expected);
  });

  const frameworkTitles = {
    angular: "Angular Icons – 24px Outline Icon Directives",
    astro: "Astro Icons – 24px Outline Icon Components",
    preact: "Preact Icons – 24px Outline Icon Components",
    react: "React Icons – 24px Outline Icon Components",
    "react-native": "React Native and Expo Icons – 24px Outline Components",
    solid: "Solid Icons – 24px Outline Icon Components",
    svelte: "Svelte Icons – 24px Outline Icon Components",
    vue: "Vue Icons – 24px Outline Icon Components",
  };

  for (const [route, title] of Object.entries(frameworkTitles)) {
    test(`${route} has a search-focused title and compact visible heading`, () => {
      const html = readDist("docs", route, "index.html");
      expect(html).toContain(`<title>${title} - Vadivam Icons</title>`);
      expect(html).toContain("free, open-source Vadivam");
      const visibleTitle = route === "react-native" ? "React Native" : route[0].toUpperCase() + route.slice(1);
      expect(html).toContain(`>${visibleTitle}</h1>`);
    });
  }

  test("root README icon count and Cloudflare canonical policy stay aligned", () => {
    const readme = readFileSync(path.join(root, "README.md"), "utf8");
    const wrangler = readFileSync(path.join(root, "wrangler.jsonc"), "utf8");
    expect(readme).toContain(`library of ${icons.length} pixel-perfect 24px outline SVG icons`);
    expect(wrangler).toContain('"html_handling": "drop-trailing-slash"');
  });
});
