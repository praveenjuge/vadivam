import { execFileSync } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { decodeStringLiteral, rankLucideIcons } from "./lucide-data.ts";

// Lucide 1.25 renamed this canonical SVG without retaining alias metadata.
const knownDeprecatedAliases = { "circle-euro-sign": "circle-euro" };
const LUCIDE_ICONS_URL = "https://lucide.dev/icons/";
const POPULARITY_RANKING = "Lucide icon-page visitors over the last 12 months";

const checkout = process.argv[2];
if (!checkout) {
  throw new Error("Usage: bun run update:lucide-data -- /path/to/lucide-checkout");
}

function checkoutVersion(directory) {
  try {
    return execFileSync(
      "git",
      ["-C", directory, "describe", "--tags", "--exact-match"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim().replace(/^v/, "");
  } catch {
    throw new Error("Lucide checkout must point to an exact release tag");
  }
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

const iconsDirectory = path.resolve(checkout, "icons");
const entries = await readdir(iconsDirectory, { withFileTypes: true });
const canonicalNames = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith(".svg"))
  .map((entry) => entry.name.slice(0, -4))
  .sort();
const canonicalNameSet = new Set(canonicalNames);
const deprecatedAliases = new Map(Object.entries(knownDeprecatedAliases));

for (const entry of entries) {
  if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
  const canonicalName = entry.name.slice(0, -5);
  if (!canonicalNameSet.has(canonicalName)) {
    throw new Error(`Lucide metadata has no matching SVG: ${entry.name}`);
  }
  const metadata = JSON.parse(
    await readFile(path.join(iconsDirectory, entry.name), "utf8"),
  );
  for (const alias of metadata.aliases ?? []) {
    if (alias.deprecated !== true) continue;
    if (canonicalNameSet.has(alias.name)) {
      throw new Error(`Deprecated Lucide alias is also canonical: ${alias.name}`);
    }
    const previous = deprecatedAliases.get(alias.name);
    if (previous && previous !== canonicalName) {
      throw new Error(`Ambiguous deprecated Lucide alias: ${alias.name}`);
    }
    deprecatedAliases.set(alias.name, canonicalName);
  }
}

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
  lucideVersion: checkoutVersion(path.resolve(checkout)),
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
  writeFile(
    new URL("lucide-icon-rankings.json", dataDirectory),
    `${JSON.stringify(rankingCatalog)}\n`,
  ),
]);

console.log(
  `Updated Lucide ${rankingCatalog.lucideVersion}: ${canonicalNames.length} canonical names, ${deprecatedAliases.size} deprecated aliases, and official popularity rankings`,
);
if (unlisted.length > 0) {
  console.log(`Not on lucide.dev yet, ranked with zero popularity: ${unlisted.join(", ")}`);
}
