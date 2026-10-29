import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { icons } from "../packages/vadivam/dist/manifest.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "apps/docs/dist/client");
const site = "https://vadivam.praveenjuge.com";
const readDist = (...segments) =>
  readFileSync(path.join(dist, ...segments), "utf8");

/** Parse every inline JSON-LD script and flatten all @graph nodes. */
function jsonLdNodes(html) {
  const graphs = [
    ...html.matchAll(
      /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
    ),
  ].map(({ 1: json }) => JSON.parse(json));
  return graphs.flatMap(({ "@graph": graph }) => graph ?? [graph]);
}

describe("website SEO", () => {
  test.each(["activity", "accessibility"])(
    "%s has one self-canonical URL across metadata",
    (name) => {
      const html = readDist("icons", name, "index.html");
      const url = `${site}/icons/${name}`;
      expect(html).toContain(`<link href="${url}" rel="canonical">`);
      expect(html).toContain(`<meta content="${url}" property="og:url">`);
      expect(html).toContain(
        `<meta content="${site}/og.png" property="og:image">`,
      );
      expect(html).toContain(
        '<meta content="@praveenjuge" name="twitter:site">',
      );
      expect(html).toContain(
        '<meta content="@praveenjuge" name="twitter:creator">',
      );
      expect(html).toContain(`"url":"${url}"`);
      expect(html).not.toContain(`<link href="${site}" rel="canonical">`);
      expect(html).not.toContain(`${site}/og/icons/${name}.png`);
    },
  );

  test.each(["activity", "accessibility"])(
    "%s links an ImageObject as its primary image",
    (name) => {
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
    },
  );

  test("homepage declares JSON-LD before the bulky icon grid", () => {
    const html = readDist("index.html");
    const ldIndex = html.indexOf('type="application/ld+json"');
    const gridIndex = html.indexOf('id="iconGrid"');
    expect(ldIndex).toBeGreaterThan(-1);
    expect(gridIndex).toBeGreaterThan(-1);
    // Crawlers that truncate the response must still see the identity graph.
    expect(ldIndex).toBeLessThan(gridIndex);
    // Measure bytes through the closing tag, since crawlers truncate bytes.
    const ldEnd = html.indexOf("</script>", ldIndex) + "</script>".length;
    expect(Buffer.byteLength(html.slice(0, ldEnd), "utf8")).toBeLessThan(
      64 * 1024,
    );
    expect(jsonLdNodes(html).map((node) => node["@type"])).toEqual([
      "WebSite",
      "WebPage",
      "SoftwareApplication",
    ]);
  });

  test("homepage stays lean: path-only tiles, lazy tags, and a size budget", () => {
    const html = readDist("index.html");
    // Tiles carry only path data; presentation attributes live in CSS.
    expect(html).toContain('<a href="/icons/activity" aria-label="activity"><svg viewBox="0 0 24 24"><path');
    // Tiles render in chunks of 120 so off-screen chunks skip style and layout.
    const chunks = html.split('<div class="icon-chunk">').length - 1;
    expect(chunks).toBe(Math.ceil(icons.length / 120));
    expect(Buffer.byteLength(html, "utf8")).toBeLessThan(1024 * 1024);
    // Tags and categories load on demand, so they never weigh down the HTML.
    expect(html).not.toContain("heart rate monitor");
    const index = JSON.parse(readDist("icons", "index.json"));
    expect(index.icons.map(([name]) => name)).toEqual(icons.map((icon) => icon.name));
    expect(index.icons.find(([name]) => name === "activity")[1]).toContain("heart rate monitor");
    // Tags are arrays, so tags containing separators such as "->|" survive.
    expect(index.icons.find(([name]) => name === "arrow-right-to-line")[1]).toContain("->|");
    expect(index.categories.arrows).toBe("Arrows");
  });

  test("icon pages show Lucide tags and categories with filter links", () => {
    const html = readDist("icons", "activity", "index.html");
    expect(html).toContain('href="/?q=pulse"');
    expect(html).toContain('href="/?category=medical"');
    expect(html).toContain("data-customizer");
  });

  test("homepage and icon pages date their WebPage from icon history", () => {
    const pages = [
      readDist("index.html"),
      readDist("icons", "activity", "index.html"),
    ];
    for (const html of pages) {
      const page = jsonLdNodes(html).find(
        ({ "@type": type }) => type === "WebPage",
      );
      expect(page?.dateModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test("docs publish the hand-written agent skill and a site footer", () => {
    const skill = readDist("skill.md");
    expect(skill).toStartWith("---\nname: vadivam-icons\n");
    expect(skill).toContain("## Gotchas");
    const html = readDist("docs", "index.html");
    expect(html).toContain('href="https://icon-sets.iconify.design/vadivam/"');
    expect(html).toContain('href="https://x.com/praveenjuge"');
  });

  test("homepage keeps WebSite identity without obsolete SearchAction markup", () => {
    const html = readDist("index.html");
    expect(html).toContain('"@type":"WebSite"');
    expect(html).not.toContain("SearchAction");
    expect(html).toContain(
      "Browse and copy pixel-perfect, open-source 24px outline icons for the web, React Native, Flutter, and Jetpack Compose.",
    );
    expect(html).toContain('<meta content="@praveenjuge" name="twitter:site">');
    expect(html).toContain(
      '<meta content="@praveenjuge" name="twitter:creator">',
    );
    expect(html).toContain("Free, open-source icons for");
    expect(html).toContain("Copy prompt for AI agents");
    // The prompt ships in a hidden, read-only textarea that the copy button
    // reveals with its text selected when the browser blocks the clipboard.
    expect(html).toMatch(/<textarea[^>]*id="agentPromptText"[^>]*readonly[^>]*hidden[^>]*>Set up Vadivam icons in this project/);
    expect(html).toContain('href="/icons/activity"');
    expect(html).toContain('data-tab="react-native"');
    expect(html).toContain("vadivam-react-native");
  });

  test("icon pages include a React Native usage snippet", () => {
    const html = readDist("icons", "activity", "index.html");
    expect(html).toContain("vadivam-react-native");
    expect(html).toContain('data-title="React Native"');
  });

  test("icon pages install each framework's own package and link related icons", () => {
    const html = readDist("icons", "bell", "index.html");
    expect(html).toContain('data-install="vadivam-vue">npm install vadivam-vue</code>');
    expect(html).toContain('data-install="vadivam">npm install vadivam</code>');
    expect(html).toContain('class="related-tile" href="/icons/bell-ring"');
    expect(html).toContain('rel="prev"');
    expect(html).toContain('rel="next"');
  });

  test("homepage declares the library as a free SoftwareApplication", () => {
    const app = jsonLdNodes(readDist("index.html")).find(
      ({ "@type": type }) => type === "SoftwareApplication",
    );
    const { version } = JSON.parse(
      readFileSync(path.join(root, "package.json"), "utf8"),
    );
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
      "Content-Signal: search=yes, ai-input=yes, ai-train=yes",
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
    const entries = Array.isArray(parsed.urlset.url)
      ? parsed.urlset.url
      : [parsed.urlset.url];
    const locations = entries.map(({ loc }) => loc);
    const feed = new XMLParser().parse(readDist("changelog", "rss.xml"));
    const releases = Array.isArray(feed.rss.channel.item)
      ? feed.rss.channel.item
      : [feed.rss.channel.item];
    // The RSS feed holds only the latest 50 releases, while every release
    // has a page in the sitemap, so the routes come from the built pages.
    const releasePages = readdirSync(path.join(dist, "changelog"), {
      recursive: true,
    })
      .filter(
        (file) =>
          path.basename(file) === "index.html" && path.dirname(file) !== ".",
      )
      .map(
        (file) =>
          `${site}/changelog/${path.dirname(file).split(path.sep).join("/")}`,
      );
    for (const { link } of releases) expect(releasePages).toContain(link);
    const changelog = [`${site}/changelog`, ...releasePages];
    const docs = readdirSync(path.join(root, "apps/docs/docs"), {
      recursive: true,
    })
      .filter((file) => file.endsWith(".md") || file.endsWith(".mdx"))
      .map((file) => {
        const base = file.endsWith(".mdx")
          ? path.basename(file, ".mdx")
          : path.basename(file, ".md");
        const slug = base.replace(/^\d+-/, "");
        return file === "index.md" || file === "index.mdx"
          ? `${site}/docs`
          : `${site}/docs/${slug}`;
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
    const iconEntries = entries.filter(({ loc }) =>
      loc.startsWith(`${site}/icons/`),
    );
    expect(iconEntries).toHaveLength(icons.length);
    for (const { lastmod } of iconEntries) {
      expect(lastmod).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.parseInt(lastmod, 10)).toBeLessThanOrEqual(
        new Date().getUTCFullYear(),
      );
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
      const visibleTitle =
        route === "react-native"
          ? "React Native"
          : route[0].toUpperCase() + route.slice(1);
      expect(html).toContain(`>${visibleTitle}</h1>`);
    });
  }

  test("tracked icon counts and Cloudflare canonical policy stay aligned", () => {
    const readme = readFileSync(path.join(root, "README.md"), "utf8");
    const docsIndex = readFileSync(
      path.join(root, "apps/docs/docs/index.mdx"),
      "utf8",
    );
    const wrangler = readFileSync(
      path.join(root, "apps/docs/wrangler.jsonc"),
      "utf8",
    );
    expect(readme).toContain(
      `library of ${icons.length} pixel-perfect 24px outline SVG icons`,
    );
    expect(docsIndex).toContain(
      `set of ${icons.length} pixel-perfect 24px outline icons`,
    );
    expect(wrangler).toContain('"html_handling": "drop-trailing-slash"');
  });
  test("Cloudflare build serves Markdown negotiation through the wrapper worker", () => {
    const serverDir = path.join(root, "apps/docs/dist/server");
    const config = JSON.parse(
      readFileSync(path.join(serverDir, "wrangler.json"), "utf8"),
    );
    // The Vadivam entry answers /mcp and delegates everything else to Blume's wrapper.
    expect(config.main).toBe("vadivam-worker.mjs");
    const entry = readFileSync(path.join(serverDir, config.main), "utf8");
    expect(entry).toContain('from "./blume-worker.mjs"');
    expect(entry).toContain('"/mcp"');
    const wrapper = readFileSync(
      path.join(serverDir, "blume-worker.mjs"),
      "utf8",
    );
    expect(wrapper).toContain("text/markdown");
    expect(wrapper.toLowerCase()).toContain("vary");
    const rules = config.assets?.run_worker_first ?? [];
    for (const route of ["/*"]) {
      expect(rules).toContain(route);
    }
    for (const raw of ["!/*.md", "!/*.mdx"]) {
      expect(rules).toContain(raw);
    }
  });

  test("shadcn registry ships as static JSON with CORS headers", () => {
    const rules = JSON.parse(
      readFileSync(path.join(root, "apps/docs/dist/server/wrangler.json"), "utf8"),
    ).assets?.run_worker_first;
    expect(rules).toContain("!/r/*");
    const registry = JSON.parse(readDist("r", "registry.json"));
    expect(registry.items).toHaveLength(icons.length + 1);
    expect(JSON.parse(readDist("r", "activity.json")).name).toBe("activity");
    expect(readDist("_headers")).toMatch(
      /^\/r\/\*\n {2}Access-Control-Allow-Origin: \*$/m,
    );
  });
});
