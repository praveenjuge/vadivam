import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Lucide 1.25 renamed this canonical SVG without retaining alias metadata.
const knownDeprecatedAliases = { "circle-euro-sign": "circle-euro" };

const checkout = process.argv[2];
if (!checkout) {
  throw new Error("Usage: bun run update:lucide-data -- /path/to/lucide-checkout");
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

const dataDirectory = new URL("../src/data/", import.meta.url);
const sortedAliases = Object.fromEntries(
  [...deprecatedAliases].sort(([left], [right]) => left.localeCompare(right)),
);
await Promise.all([
  writeFile(
    new URL("lucide-icon-names.json", dataDirectory),
    `${JSON.stringify(canonicalNames)}\n`,
  ),
  writeFile(
    new URL("lucide-deprecated-aliases.json", dataDirectory),
    `${JSON.stringify(sortedAliases, null, 2)}\n`,
  ),
]);

console.log(
  `Updated ${canonicalNames.length} canonical Lucide names and ${deprecatedAliases.size} deprecated aliases`,
);
