import { execFileSync } from "node:child_process";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { styles } from "./icon-styles.mjs";
import { metadataFiles, root } from "./lib/paths.mjs";

const lucideMetadataPath = path.join(root, metadataFiles.lucide);
const lucideAliasesPath = path.join(root, metadataFiles.aliases);

// Lucide 1.25 renamed this canonical SVG without retaining alias metadata.
const missingDeprecatedAliases = { "circle-euro-sign": "circle-euro" };

/** Every deprecated Lucide name and the canonical icon it now points to, sorted. */
export function lucideAliases({ deprecatedAliases }) {
  return new Map(
    [...Object.entries(missingDeprecatedAliases), ...deprecatedAliases].sort(([left], [right]) => left.localeCompare(right)),
  );
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

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function validStrings(value, maxLength) {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string" && item.length > 0 && item.length <= maxLength)
  );
}

async function readLucideGroups(directory) {
  let files;
  try {
    files = await readdir(directory);
  } catch {
    return {};
  }
  const groups = {};
  for (const fileName of files) {
    if (!fileName.endsWith(".json")) continue;
    groups[fileName.slice(0, -5)] = (await readJson(path.join(directory, fileName))).tags ?? [];
  }
  return groups;
}

// Since 1.65, Lucide metadata can inherit tags and categories with
// `$extends:<icon>`, and pull shared tags with `$group:<group>`. Expand them in
// place the way Lucide's build does, keeping the first occurrence of each value.
function resolveField(name, field, allMetadata, groups, stack = new Set()) {
  if (stack.has(name)) throw new Error(`Lucide metadata extends itself in a cycle: ${name}`);
  stack.add(name);
  const expanded = [];
  for (const value of allMetadata[name][field] ?? []) {
    if (typeof value === "string" && value.startsWith("$extends:")) {
      const parent = value.slice("$extends:".length);
      if (!allMetadata[parent]) throw new Error(`Lucide metadata for ${name} extends unknown icon ${parent}`);
      expanded.push(...resolveField(parent, field, allMetadata, groups, stack));
    } else if (typeof value === "string" && value.startsWith("$group:")) {
      const group = value.slice("$group:".length);
      if (field !== "tags" || !groups[group]) throw new Error(`Lucide metadata for ${name} uses unknown group ${group}`);
      expanded.push(...groups[group]);
    } else {
      expanded.push(value);
    }
  }
  stack.delete(name);
  return [...new Set(expanded)];
}

/**
 * Read canonical names, tags, categories, and deprecated aliases from a Lucide
 * release checkout. Only canonical names are published as icons; the deprecated
 * aliases feed the Figma maintenance plugin's rename tooling and the
 * `vadivam migrate-lucide` codemod, which renames alias imports.
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
  const allMetadata = {};
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const name = entry.name.slice(0, -5);
    if (!nameSet.has(name)) throw new Error(`Lucide metadata has no matching SVG: ${entry.name}`);
    allMetadata[name] = await readJson(path.join(iconsDirectory, entry.name));
  }
  const groups = await readLucideGroups(path.join(directory, "groups"));
  const deprecatedAliases = new Map();
  for (const [name, metadata] of Object.entries(allMetadata)) {
    const tags = resolveField(name, "tags", allMetadata, groups);
    const iconCategories = resolveField(name, "categories", allMetadata, groups);
    if (!validStrings(tags, 80)) throw new Error(`Lucide metadata has invalid tags: ${name}.json`);
    if (!validStrings(iconCategories, 80) || iconCategories.some((id) => !categories[id])) {
      throw new Error(`Lucide metadata has unknown categories: ${name}.json`);
    }
    icons[name] = {
      tags: [...new Set(tags.map((tag) => tag.trim().toLowerCase()))],
      categories: [...new Set(iconCategories)],
    };
    // Lucide also keeps a few live aliases, such as `bold` for `letter-b`.
    // Vadivam publishes canonical names only, so those rename the same way.
    for (const alias of metadata.aliases ?? []) {
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

/** Writes the tags and categories of the drawn icons, and every deprecated alias. */
export async function writeLucideMetadata(catalog) {
  const { version, categories, icons } = catalog;
  await mkdir(path.dirname(lucideMetadataPath), { recursive: true });
  // Only drawn icons get an entry, so a Lucide release can be pinned before
  // every new name has a Vadivam drawing. Rerun after adding icons.
  const drawn = new Set(
    (await readdir(path.join(root, styles.outline.sourceDirectory)))
      .filter((fileName) => fileName.endsWith(".svg"))
      .map((fileName) => fileName.slice(0, -4)),
  );
  // One line per icon keeps diffs reviewable when Lucide retags an icon.
  const iconLines = Object.keys(icons)
    .filter((name) => drawn.has(name))
    .sort()
    .map((name) => `    ${JSON.stringify(name)}: ${JSON.stringify(icons[name])}`);
  await writeFile(
    lucideMetadataPath,
    `{\n  "lucideVersion": ${JSON.stringify(version)},\n  "categories": ${JSON.stringify(categories, null, 2).replaceAll("\n", "\n  ")},\n  "icons": {\n${iconLines.join(",\n")}\n  }\n}\n`,
  );
  await writeFile(lucideAliasesPath, `${JSON.stringify(Object.fromEntries(lucideAliases(catalog)), null, 2)}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const checkout = process.argv[2];
  if (!checkout) throw new Error("Usage: bun run icons:metadata -- /path/to/lucide-checkout");
  const catalog = await readLucideCheckout(checkout);
  await writeLucideMetadata(catalog);
  console.log(
    `Wrote ${path.relative(root, lucideMetadataPath)} and ${path.relative(root, lucideAliasesPath)} for Lucide ${catalog.version}: ${catalog.names.length} icons, ${Object.keys(catalog.categories).length} categories`,
  );
}
