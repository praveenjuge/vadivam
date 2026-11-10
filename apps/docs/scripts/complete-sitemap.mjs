import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { icons } from "vadivam/manifest";
import { siteUrl } from "../../../scripts/packages.mjs";
import { iconLastmods } from "./icon-lastmods.mjs";
import { docsPaths, fromRoot } from "./paths.mjs";

const xmlEscape = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const asArray = (value) =>
  Array.isArray(value) ? value : value ? [value] : [];

export function completeSitemap(xml, iconNames, iconLastmod = {}) {
  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    throw new Error(`Invalid generated sitemap: ${validation.err.msg}`);
  }

  const parsed = new XMLParser().parse(xml);
  const entries = asArray(parsed?.urlset?.url);
  const locs = entries.map(({ loc }) => loc);
  if (!locs.length) throw new Error("Generated sitemap contains no URLs");
  if (new Set(locs).size !== locs.length) {
    throw new Error("Generated sitemap contains duplicate URLs");
  }

  const origin = new URL(locs[0]).origin;
  const byLocation = new Map(entries.map((entry) => [entry.loc, entry]));
  for (const name of iconNames) {
    const loc = `${origin}/icons/${encodeURIComponent(name)}`;
    if (byLocation.has(loc)) throw new Error(`Duplicate icon URL: ${loc}`);
    const lastmod = iconLastmod[name];
    byLocation.set(loc, lastmod ? { loc, lastmod } : { loc });
  }

  const expectedCount = entries.length + iconNames.length;
  if (byLocation.size !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} sitemap URLs, found ${byLocation.size}`,
    );
  }

  const rows = [...byLocation.values()]
    .sort((a, b) => a.loc.localeCompare(b.loc))
    .map(({ loc, lastmod }) => {
      const modified = lastmod
        ? `<lastmod>${xmlEscape(String(lastmod))}</lastmod>`
        : "";
      return `  <url><loc>${xmlEscape(loc)}</loc>${modified}</url>`;
    });
  const output = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join("\n")}\n</urlset>\n`;

  const outputValidation = XMLValidator.validate(output);
  if (outputValidation !== true) {
    throw new Error(
      `Completed sitemap is invalid: ${outputValidation.err.msg}`,
    );
  }
  for (const name of iconNames) {
    const expected = `${origin}/icons/${encodeURIComponent(name)}`;
    if (!output.includes(`<loc>${xmlEscape(expected)}</loc>`)) {
      throw new Error(`Completed sitemap is missing ${expected}`);
    }
  }
  return output;
}

export function completeLlmsIndex(markdown, site) {
  if (!markdown.trimStart().startsWith("# ")) {
    throw new Error("Generated llms.txt does not start with a title");
  }

  const homepage = `${new URL(site).origin}/`;
  if (markdown.includes(`](${homepage})`)) return markdown;

  return `${markdown.trimEnd()}\n\n## Icon catalog\n\n- [Browse all Vadivam icons](${homepage}): Search the complete icon catalog, copy SVG markup, and find framework components.\n`;
}


/** Add every icon page to Blume's sitemap.xml and the icon catalog to its llms.txt. */
export async function completeSitemapFiles() {
  const sitemapPath = path.join(fromRoot(docsPaths.client), "sitemap.xml");
  const llmsPath = path.join(fromRoot(docsPaths.client), "llms.txt");
  const [xml, llms] = await Promise.all([readFile(sitemapPath, "utf8"), readFile(llmsPath, "utf8")]);
  const lastmods = iconLastmods();
  const iconNames = icons.map(({ name }) => name);
  await Promise.all([
    writeFile(sitemapPath, completeSitemap(xml, iconNames, Object.fromEntries(lastmods))),
    writeFile(llmsPath, completeLlmsIndex(llms, siteUrl)),
  ]);
  const applied = iconNames.filter((name) => lastmods.has(name)).length;
  console.log(
    `Completed sitemap.xml with ${icons.length} icon URLs (${applied} carrying lastmod) and added the icon catalog to llms.txt.`,
  );
}
