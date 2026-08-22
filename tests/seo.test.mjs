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

/** Parse every inline JSON-LD script and flatten all @graph nodes. */
function jsonLdNodes(html) {
  const graphs = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(
    ({ 1: json }) => JSON.parse(json),
  );
  return graphs.flatMap(({ "@graph": graph }) => graph ?? [graph]);
}

describe("website SEO", () => {
  test.each(["activity", "accessibility"])("%s has one self-canonical URL across metadata", (name) => {
    const html = readDist("icons", name, "index.html");
    const url = `${site}/icons/${name}`;
    expect(html).toContain(`<link href="${url}" rel="canonical">`);
    expect(html).toContain(`<meta content="${url}" property="og:url">`);
    expect(html).toContain(`<meta content="${site}/og.png" property="og:image">`);
    expect(html).toContain('<meta content="@praveenjuge" name="twitter:site">');
    expect(html).toContain('<meta content="@praveenjuge" name="twitter:creator">');
    expect(html).toContain(`"url":"${url}"`);
    expect(html).not.toContain(`<link href="${site}" rel="canonical">`);
    expect(html).not.toContain(`${site}/og/icons/${name}.png`);
  });

  test.each(["activity", "accessibility"])("%s links an ImageObject as its primary image", (name) => {
    const nodes = jsonLdNodes(readDist("icons", name, "index.html"));
    const byId = new Map(nodes.map((node) => [node["@id"], node]));
    const page = nodes.find(({ "@type": type }) => type === "WebPage");
    const imageId = `${site}/icons/${name}#image`;
    expect(page?.primaryImageOfPage).toEqual({ "@id": imageId });
    expect(byId.get(imageId)).toMatchObject({
      "@type": "ImageObject",
      contentUrl: `${site}/icons/${name}.svg`,
      encodingFormat: "image/svg+xml",
    });
  });

  test("homepage keeps WebSite identity without obsolete SearchAction markup", () => {
    const html = readDist("index.html");
    expect(html).toContain('"@type":"WebSite"');
    expect(html).not.toContain("SearchAction");
    expect(html).toContain(
      "Browse pixel-perfect, open-source 24px outline icons for SVG, React, React Native, Vue, Svelte, Solid, Angular, Astro, and Preact."
    );
    expect(html).toContain('<meta content="@praveenjuge" name="twitter:site">');
    expect(html).toContain('<meta content="@praveenjuge" name="twitter:creator">');
    expect(html).toContain("A free, open-source icon set made for designers and developers building thoughtful digital experiences.");
    expect(html).toContain('href="/icons/activity"');
  });

  test("homepage declares the library as a free SoftwareApplication", () => {
    const app = jsonLdNodes(readDist("index.html")).find(({ "@type": type }) => type === "SoftwareApplication");
    const { version } = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
    expect(app).toMatchObject({
      "@id": `${site}#software`,
      applicationCategory: "DesignApplication",
      operatingSystem: "Any",
      softwareVersion: version,
      screenshot: `${site}/preview.png`,
      license: "https://github.com/praveenjuge/vadivam/blob/main/LICENSE",
      author: { "@type": "Person", name: "Praveen Juge" },
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    });
  });

  test("robots allows search, AI grounding, and AI training", () => {
    expect(readDist("robots.txt")).toContain(
      "Content-Signal: search=yes, ai-input=yes, ai-train=yes"
    );
  });

  test("llms index includes the custom icon catalog homepage", () => {
    const llms = readDist("llms.txt");
    expect(llms).toContain(`- [Browse all Vadivam icons](${site}/)`);
    expect(llms.split(`](${site}/)`)).toHaveLength(2);
  });

  test("dynamic icon pages share a valid social image", () => {
    const image = readFileSync(path.join(dist, "og.png"));
    expect(image.subarray(1, 4).toString()).toBe("PNG");
    expect(image.readUInt32BE(16)).toBe(1200);
    expect(image.readUInt32BE(20)).toBe(630);
  });

  test("changelog renders GitHub releases with a discoverable RSS feed", () => {
    const html = readDist("changelog", "index.html");
    const feed = new XMLParser().parse(readDist("changelog", "rss.xml"));
    const releases = Array.isArray(feed.rss.channel.item)
      ? feed.rss.channel.item
      : [feed.rss.channel.item];

    expect(html).toContain("<h1>Changelog</h1>");
    expect(html).toContain('href="/changelog">Changelog</a>');
    expect(html).toContain('href="/changelog/rss.xml" rel="alternate"');
    expect(releases.length).toBeGreaterThan(0);
    expect(html).toContain(`href="${new URL(releases[0].link).pathname}"`);
  });

  test("sitemap contains exactly the homepage, docs, changelog, and canonical icon routes", () => {
    const xml = readDist("sitemap.xml");
    expect(XMLValidator.validate(xml)).toBe(true);
    const parsed = new XMLParser().parse(xml);
    const entries = Array.isArray(parsed.urlset.url) ? parsed.urlset.url : [parsed.urlset.url];
    const locations = entries.map(({ loc }) => loc);
    const feed = new XMLParser().parse(readDist("changelog", "rss.xml"));
    const releases = Array.isArray(feed.rss.channel.item)
      ? feed.rss.channel.item
      : [feed.rss.channel.item];
    const changelog = [`${site}/changelog`, ...releases.map(({ link }) => link)];
    const docs = readdirSync(path.join(root, "apps/docs/docs"), { recursive: true })
      .filter((file) => file.endsWith(".md"))
      .map((file) => {
        const slug = path.basename(file, ".md").replace(/^\d+-/, "");
        return file === "index.md" ? `${site}/docs` : `${site}/docs/${slug}`;
      });
    const expected = [
      site + "/",
      ...changelog,
      ...docs,
      ...icons.map(({ name }) => `${site}/icons/${name}`),
    ].sort();
    expect(locations).toHaveLength(expected.length);
    expect(new Set(locations).size).toBe(locations.length);
    expect(locations.sort()).toEqual(expected);
    const iconEntries = entries.filter(({ loc }) => loc.startsWith(`${site}/icons/`));
    expect(iconEntries).toHaveLength(icons.length);
    for (const { lastmod } of iconEntries) {
      expect(lastmod).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.parseInt(lastmod, 10)).toBeLessThanOrEqual(new Date().getUTCFullYear());
    }
  });

  const frameworkTitles = {
    angular: "Angular Icons – 24px Outline Icon Directives",
    astro: "Astro Icons – 24px Outline Icon Components",
    preact: "Preact Icons – 24px Outline Icon Components",
    react: "React Icons – 24px Outline Icon Components",
    "react-native": "React Native Icons – 24px Outline Components",
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

  test("tracked icon counts and Cloudflare canonical policy stay aligned", () => {
    const readme = readFileSync(path.join(root, "README.md"), "utf8");
    const docsIndex = readFileSync(path.join(root, "apps/docs/docs/index.md"), "utf8");
    const wrangler = readFileSync(path.join(root, "wrangler.jsonc"), "utf8");
    expect(readme).toContain(`library of ${icons.length} pixel-perfect 24px outline SVG icons`);
    expect(docsIndex).toContain(`set of ${icons.length} pixel-perfect 24px outline icons`);
    expect(wrangler).toContain('"html_handling": "drop-trailing-slash"');
  });
});
