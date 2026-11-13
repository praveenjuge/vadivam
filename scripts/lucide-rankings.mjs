// Ranks every canonical Lucide icon by its lucide.dev popularity, for the
// maintenance plugin's catalog and the MCP server's tie-breaks. Writes
// metadata/lucide-rankings.json for the Lucide release a checkout is on.
// Usage: bun run icons:rankings -- /path/to/lucide-checkout
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { metadataFiles, root } from "./lib/paths.mjs";
import { lucideAliases, readLucideCheckout } from "./lucide-metadata.mjs";

const LUCIDE_ICONS_URL = "https://lucide.dev/icons/";
const POPULARITY_RANKING = "Lucide icon-page visitors over the last 12 months";
const rankingsPath = path.join(root, metadataFiles.rankings);

// lucide.dev can trail the newest release by a few days. More unlisted icons
// than this means the site data changed shape rather than just lagging.
export const MAX_UNLISTED_ICONS = 25;

const simpleEscapes = {
  "'": "'",
  '"': '"',
  "`": "`",
  $: "$",
  "\\": "\\",
  "/": "/",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
  v: "\v",
  0: "\0",
};

// Decodes a JavaScript string literal quoted with ', " or ` (a template
// literal without substitutions), starting at its opening quote.
export function decodeStringLiteral(source, quoteIndex) {
  const quote = source[quoteIndex];
  if (quote !== "'" && quote !== '"' && quote !== "`") {
    throw new Error("Lucide data is not a string literal");
  }
  let result = "";
  for (let index = quoteIndex + 1; index < source.length; index += 1) {
    const character = source[index];
    if (character === quote) return result;
    if (quote === "`" && character === "$" && source[index + 1] === "{") {
      throw new Error("Unsupported template substitution in Lucide data");
    }
    if (character !== "\\") {
      result += character;
      continue;
    }

    index += 1;
    const escaped = source[index];
    const simple = escaped === undefined ? undefined : simpleEscapes[escaped];
    if (simple !== undefined) {
      result += simple;
      continue;
    }
    if (escaped === "x") {
      const hex = source.slice(index + 1, index + 3);
      if (!/^[0-9a-f]{2}$/i.test(hex)) throw new Error("Invalid hex escape in Lucide data");
      result += String.fromCodePoint(Number.parseInt(hex, 16));
      index += 2;
      continue;
    }
    if (escaped === "u") {
      const braced = source[index + 1] === "{";
      const end = braced ? source.indexOf("}", index + 2) : index + 5;
      const hex = source.slice(index + (braced ? 2 : 1), end);
      if (!(braced ? /^[0-9a-f]{1,6}$/i : /^[0-9a-f]{4}$/i).test(hex)) {
        throw new Error("Invalid Unicode escape in Lucide data");
      }
      result += String.fromCodePoint(Number.parseInt(hex, 16));
      // Leave index on the escape's last character; the loop steps past it.
      index = braced ? end : end - 1;
      continue;
    }
    if (escaped === "\n" || escaped === "\r") continue;
    throw new Error(`Unsupported escape in Lucide data: \\${escaped}`);
  }
  throw new Error("Unterminated Lucide icon data string");
}

// Ranks every canonical icon by lucide.dev popularity, most popular first.
export function rankLucideIcons(canonicalNames, deprecatedAliases, sitePopularity) {
  const popularity = new Map(sitePopularity);
  // A lagging site still lists a renamed icon under its deprecated alias.
  for (const [alias, canonicalName] of deprecatedAliases) {
    const aliasPopularity = popularity.get(alias);
    if (!popularity.has(canonicalName) && aliasPopularity !== undefined) {
      popularity.set(canonicalName, aliasPopularity);
    }
  }
  const unlisted = canonicalNames.filter((name) => !popularity.has(name));
  if (unlisted.length > MAX_UNLISTED_ICONS) {
    throw new Error(`Lucide site is missing ${unlisted.length} canonical icons: ${unlisted.join(", ")}`);
  }
  const icons = canonicalNames
    // Icons released after the site's last deploy have no visitors yet.
    .map((name) => ({ name, popularity: popularity.get(name) ?? 0 }))
    .sort(
      (left, right) =>
        right.popularity - left.popularity || left.name.localeCompare(right.name),
    )
    .map((icon, index) => ({ ...icon, rank: index + 1 }));
  return { icons, unlisted };
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const checkout = process.argv[2];
  if (!checkout) throw new Error("Usage: bun run icons:rankings -- /path/to/lucide-checkout");
  const catalog = await readLucideCheckout(checkout);
  const { icons, unlisted } = rankLucideIcons(catalog.names, lucideAliases(catalog), await fetchLucidePopularity());
  const rankings = {
    lucideVersion: catalog.version,
    source: LUCIDE_ICONS_URL,
    retrievedAt: new Date().toISOString(),
    ranking: POPULARITY_RANKING,
    icons,
  };
  await writeFile(rankingsPath, `${JSON.stringify(rankings)}\n`);
  console.log(`Wrote ${path.relative(root, rankingsPath)} for Lucide ${catalog.version}: ${icons.length} icons ranked by popularity`);
  if (unlisted.length > 0) {
    console.log(`Not on lucide.dev yet, ranked with zero popularity: ${unlisted.join(", ")}`);
  }
}
