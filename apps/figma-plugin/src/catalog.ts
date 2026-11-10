import { nameFields, searchIcons as search, type SearchEntry } from "../../figma-shared/search";

export type IconEntry = SearchEntry;

export function createEntries(
  icons: ReadonlyArray<readonly [string, readonly string[], readonly string[]]>,
  categoryTitles: ReadonlyMap<string, string>,
): IconEntry[] {
  return icons.map(([name, tags, categories]) => ({
    ...nameFields(name),
    categories,
    tags: tags.map((tag) => tag.toLowerCase()),
    categoryTitles: categories.map((id) => (categoryTitles.get(id) ?? id).toLowerCase()),
  }));
}

// Designers type names in any spelling and make typos, so names match loosely
// and near misses count. Entries arrive sorted by name, so ties keep
// alphabetical order after the length tiebreak.
export function searchIcons(entries: readonly IconEntry[], query: string, category = ""): IconEntry[] {
  return search(entries, query, { category, looseNames: true, typos: true, shortestFirst: true });
}
