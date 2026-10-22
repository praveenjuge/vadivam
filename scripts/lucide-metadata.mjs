import { execFileSync } from "node:child_process";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const lucideMetadataPath = path.join(root, "metadata/lucide.json");

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

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function validStrings(value, maxLength) {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string" && item.length > 0 && item.length <= maxLength)
  );
}

/**
 * Read canonical names, tags, categories, and deprecated aliases from a Lucide
 * release checkout. Only canonical names are published; the deprecated aliases
 * stay internal to the Figma maintenance plugin's rename tooling.
 */
export async function readLucideCheckout(checkout) {
  const directory = path.resolve(checkout);
  const iconsDirectory = path.join(directory, "icons");
  const categoriesDirectory = path.join(directory, "categories");
  const entries = await readdir(iconsDirectory, { withFileTypes: true });
  const names = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".svg"))
    .map((entry) => entry.name.slice(0, -4))
    .sort();
  const nameSet = new Set(names);

  const categories = {};
  for (const fileName of (await readdir(categoriesDirectory)).sort()) {
    if (!fileName.endsWith(".json")) continue;
    const id = fileName.slice(0, -5);
    const { title, description } = await readJson(path.join(categoriesDirectory, fileName));
    if (typeof title !== "string" || title.length === 0) {
      throw new Error(`Lucide category has no title: ${fileName}`);
    }
    categories[id] = { title, ...(typeof description === "string" && { description }) };
  }

  const icons = Object.fromEntries(names.map((name) => [name, { tags: [], categories: [] }]));
  const deprecatedAliases = new Map();
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const name = entry.name.slice(0, -5);
    if (!nameSet.has(name)) throw new Error(`Lucide metadata has no matching SVG: ${entry.name}`);
    const metadata = await readJson(path.join(iconsDirectory, entry.name));
    const tags = metadata.tags ?? [];
    const iconCategories = metadata.categories ?? [];
    if (!validStrings(tags, 80)) throw new Error(`Lucide metadata has invalid tags: ${entry.name}`);
    if (!validStrings(iconCategories, 80) || iconCategories.some((id) => !categories[id])) {
      throw new Error(`Lucide metadata has unknown categories: ${entry.name}`);
    }
    icons[name] = {
      tags: [...new Set(tags.map((tag) => tag.trim().toLowerCase()))],
      categories: [...new Set(iconCategories)],
    };
    for (const alias of metadata.aliases ?? []) {
      if (alias.deprecated !== true) continue;
      if (nameSet.has(alias.name)) {
        throw new Error(`Deprecated Lucide alias is also canonical: ${alias.name}`);
      }
      const previous = deprecatedAliases.get(alias.name);
      if (previous && previous !== name) {
        throw new Error(`Ambiguous deprecated Lucide alias: ${alias.name}`);
      }
      deprecatedAliases.set(alias.name, name);
    }
  }

  return { version: checkoutVersion(directory), names, categories, icons, deprecatedAliases };
}

export async function writeLucideMetadata({ version, categories, icons }) {
  await mkdir(path.dirname(lucideMetadataPath), { recursive: true });
  // One line per icon keeps diffs reviewable when Lucide retags an icon.
  const iconLines = Object.keys(icons)
    .sort()
    .map((name) => `    ${JSON.stringify(name)}: ${JSON.stringify(icons[name])}`);
  await writeFile(
    lucideMetadataPath,
    `{\n  "lucideVersion": ${JSON.stringify(version)},\n  "categories": ${JSON.stringify(categories, null, 2).replaceAll("\n", "\n  ")},\n  "icons": {\n${iconLines.join(",\n")}\n  }\n}\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const checkout = process.argv[2];
  if (!checkout) throw new Error("Usage: bun run icons:metadata -- /path/to/lucide-checkout");
  const catalog = await readLucideCheckout(checkout);
  await writeLucideMetadata(catalog);
  console.log(
    `Wrote ${path.relative(root, lucideMetadataPath)} for Lucide ${catalog.version}: ${catalog.names.length} icons, ${Object.keys(catalog.categories).length} categories`,
  );
}
