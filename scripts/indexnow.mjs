import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser, XMLValidator } from "fast-xml-parser";

export const INDEXNOW_KEY = "c8e4f1a27b9d40c6a3e15f8d2b7c4e91";
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
export const SITE_ORIGIN = "https://vadivam.praveenjuge.com";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sitemapPath = path.join(root, "apps/docs/dist/sitemap.xml");

const asArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);

export function indexNowKeyFileName(key = INDEXNOW_KEY) {
  return `${key}.txt`;
}

export function indexNowKeyLocation(origin = SITE_ORIGIN, key = INDEXNOW_KEY) {
  return `${origin.replace(/\/$/, "")}/${indexNowKeyFileName(key)}`;
}

export function sitemapLocations(xml) {
  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    throw new Error(`Invalid sitemap: ${validation.err.msg}`);
  }
  const parsed = new XMLParser().parse(xml);
  const locs = asArray(parsed?.urlset?.url)
    .map(({ loc }) => loc)
    .filter(Boolean);
  if (!locs.length) throw new Error("Sitemap contains no URLs");
  return locs;
}

export function indexNowPayload(urls, { origin = SITE_ORIGIN, key = INDEXNOW_KEY } = {}) {
  const host = new URL(origin).host;
  return {
    host,
    key,
    keyLocation: indexNowKeyLocation(origin, key),
    urlList: urls,
  };
}

export async function submitIndexNow(
  urls,
  { fetchImpl = fetch, endpoint = INDEXNOW_ENDPOINT, origin = SITE_ORIGIN, key = INDEXNOW_KEY } = {},
) {
  const payload = indexNowPayload(urls, { origin, key });
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`IndexNow ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  return payload;
}

if (import.meta.main) {
  if (process.env.INDEXNOW_SKIP === "1") {
    process.stdout.write("Skipped IndexNow (INDEXNOW_SKIP=1).\n");
    process.exit(0);
  }
  const xml = await readFile(sitemapPath, "utf8");
  const urls = sitemapLocations(xml);
  await submitIndexNow(urls);
  process.stdout.write(`Submitted ${urls.length} URLs to IndexNow.\n`);
}
