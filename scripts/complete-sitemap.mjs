import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { icons } from "../packages/vadivam/dist/manifest.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sitemapPath = path.join(root, "apps/docs/dist/sitemap.xml");

const xmlEscape = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const asArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);

export function completeSitemap(xml, iconNames) {
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
    byLocation.set(loc, { loc });
  }

  const expectedCount = entries.length + iconNames.length;
  if (byLocation.size !== expectedCount) {
    throw new Error(`Expected ${expectedCount} sitemap URLs, found ${byLocation.size}`);
  }

  const rows = [...byLocation.values()]
    .sort((a, b) => a.loc.localeCompare(b.loc))
    .map(({ loc, lastmod }) => {
      const modified = lastmod ? `<lastmod>${xmlEscape(String(lastmod))}</lastmod>` : "";
      return `  <url><loc>${xmlEscape(loc)}</loc>${modified}</url>`;
    });
  const output = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join("\n")}\n</urlset>\n`;

  const outputValidation = XMLValidator.validate(output);
  if (outputValidation !== true) {
    throw new Error(`Completed sitemap is invalid: ${outputValidation.err.msg}`);
  }
  for (const name of iconNames) {
    const expected = `${origin}/icons/${encodeURIComponent(name)}`;
    if (!output.includes(`<loc>${xmlEscape(expected)}</loc>`)) {
      throw new Error(`Completed sitemap is missing ${expected}`);
    }
  }
  return output;
}

if (import.meta.main) {
  const xml = await readFile(sitemapPath, "utf8");
  const output = completeSitemap(xml, icons.map(({ name }) => name));
  await writeFile(sitemapPath, output);
  process.stdout.write(`Completed sitemap.xml with ${icons.length} icon URLs.\n`);
}
