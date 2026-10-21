import { writeFile } from "node:fs/promises";
import { readLucideCheckout, writeLucideMetadata } from "../../../scripts/lucide-metadata.mjs";
import { decodeStringLiteral, rankLucideIcons } from "./lucide-data.ts";

// Lucide 1.25 renamed this canonical SVG without retaining alias metadata.
const knownDeprecatedAliases = { "circle-euro-sign": "circle-euro" };
const LUCIDE_ICONS_URL = "https://lucide.dev/icons/";
const POPULARITY_RANKING = "Lucide icon-page visitors over the last 12 months";

const checkout = process.argv[2];
if (!checkout) {
  throw new Error("Usage: bun run update:lucide-data -- /path/to/lucide-checkout");
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "vadivam-lucide-catalog-updater" },
  });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  return response.text();
}

async function fetchLucidePopularity() {
  const page = await fetchText(LUCIDE_ICONS_URL);
  const chunkPath = page.match(
    /\/assets\/chunks\/useIconsWithExternalLibs\.[A-Za-z0-9_-]+\.js/,
  )?.[0];
  if (!chunkPath) throw new Error("Could not locate Lucide icon data asset");

  const source = await fetchText(new URL(chunkPath, LUCIDE_ICONS_URL));
  const markerIndex = source.search(/=JSON\.parse\(['`]\{"icons":\[/);
  if (markerIndex < 0) throw new Error("Could not locate Lucide icon catalog data");
  const quoteIndex = markerIndex + "=JSON.parse(".length;
  const catalog = JSON.parse(decodeStringLiteral(source, quoteIndex));
  if (!Array.isArray(catalog.icons)) throw new Error("Lucide site icon data is invalid");

  const popularity = new Map();
  for (const icon of catalog.icons) {
    if (
      !icon ||
      typeof icon.name !== "string" ||
      !Number.isSafeInteger(icon.popularity) ||
      icon.popularity < 0 ||
      popularity.has(icon.name)
    ) {
      throw new Error("Lucide site contains invalid popularity data");
    }
    popularity.set(icon.name, icon.popularity);
  }
  return popularity;
}

const catalog = await readLucideCheckout(checkout);
const canonicalNames = catalog.names;
const deprecatedAliases = new Map([
  ...Object.entries(knownDeprecatedAliases),
  ...catalog.deprecatedAliases,
]);

const { icons: rankings, unlisted } = rankLucideIcons(
  canonicalNames,
  deprecatedAliases,
  await fetchLucidePopularity(),
);

const dataDirectory = new URL("../src/data/", import.meta.url);
const sortedAliases = Object.fromEntries(
  [...deprecatedAliases].sort(([left], [right]) => left.localeCompare(right)),
);
const rankingCatalog = {
  lucideVersion: catalog.version,
  source: LUCIDE_ICONS_URL,
  retrievedAt: new Date().toISOString(),
  ranking: POPULARITY_RANKING,
  icons: rankings,
};
await Promise.all([
  writeFile(
    new URL("lucide-icon-names.json", dataDirectory),
    `${JSON.stringify(canonicalNames)}\n`,
  ),
  writeFile(
    new URL("lucide-deprecated-aliases.json", dataDirectory),
    `${JSON.stringify(sortedAliases, null, 2)}\n`,
  ),
  writeLucideMetadata(catalog),
  writeFile(
    new URL("lucide-icon-rankings.json", dataDirectory),
    `${JSON.stringify(rankingCatalog)}\n`,
  ),
]);

console.log(
  `Updated Lucide ${rankingCatalog.lucideVersion}: ${canonicalNames.length} canonical names, ${deprecatedAliases.size} deprecated aliases, tags, categories, and official popularity rankings`,
);
if (unlisted.length > 0) {
  console.log(`Not on lucide.dev yet, ranked with zero popularity: ${unlisted.join(", ")}`);
}
