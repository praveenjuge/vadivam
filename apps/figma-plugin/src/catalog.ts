import { editDistance } from "../../figma-shared/names";

export interface IconEntry {
  name: string;
  /** Category ids, used by the category filter. */
  categories: readonly string[];
  /** Lowercase search fields, computed once so a keystroke only compares strings. */
  compact: string;
  words: string;
  tags: readonly string[];
  categoryTitles: readonly string[];
}

export function createEntries(
  icons: ReadonlyArray<readonly [string, readonly string[], readonly string[]]>,
  categoryTitles: ReadonlyMap<string, string>,
): IconEntry[] {
  return icons.map(([name, tags, categories]) => ({
    name,
    categories,
    compact: name.replace(/-/g, ""),
    words: name.replace(/-/g, " "),
    tags: tags.map((tag) => tag.toLowerCase()),
    categoryTitles: categories.map((id) => (categoryTitles.get(id) ?? id).toLowerCase()),
  }));
}

// Terms keep their symbols so tags like `$`, `@`, or `->|` stay searchable.
export function searchTerms(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

// Names only hold letters, digits, and hyphens, so `arrow_down` and `ArrowDown` still match.
function nameTerm(term: string): string {
  return term.replace(/[^a-z0-9-]/g, "");
}

// Lower ranks sort first: exact name, name prefix, name word, tag prefix, tag, category, typo.
function termRank(entry: IconEntry, term: string): number {
  const name = nameTerm(term);
  const compactTerm = name.replace(/-/g, "");
  if (compactTerm) {
    if (entry.name === name || entry.compact === compactTerm) return 0;
    if (entry.name.startsWith(name) || entry.compact.startsWith(compactTerm)) return 1;
    if (entry.words.includes(name) || entry.compact.includes(compactTerm)) return 2;
  }
  // The raw term keeps symbol tags like `$`; the cleaned one drops stray punctuation like `sort,`.
  const words = name && name !== term ? [term, name] : [term];
  if (entry.tags.some((tag) => words.some((word) => tag.startsWith(word)))) return 3;
  if (entry.tags.some((tag) => words.some((word) => tag.includes(word)))) return 4;
  if (entry.categoryTitles.some((title) => words.some((word) => title.includes(word)))) return 5;

  const limit = compactTerm.length >= 7 ? 2 : 1;
  return compactTerm.length >= 3 && editDistance(entry.compact, compactTerm, limit) <= limit ? 6 : -1;
}

function rankEntry(entry: IconEntry, terms: readonly string[]): number {
  if (terms.length === 0) return 0;
  // Joined words like `arrow down` match hyphenated names only when every word is a name word.
  const nameTerms = terms.map(nameTerm);
  const joined = nameTerms.join("-");
  if (terms.length > 1 && nameTerms.every(Boolean) && entry.name.includes(joined)) {
    return entry.name === joined ? 0 : 1;
  }
  let rank = 0;
  for (const term of terms) {
    const termRanked = termRank(entry, term);
    if (termRanked < 0) return -1;
    rank = Math.max(rank, termRanked);
  }
  return rank;
}

// Entries arrive sorted by name, so ties keep alphabetical order after the length tiebreak.
export function searchIcons(
  entries: readonly IconEntry[],
  query: string,
  category = "",
): IconEntry[] {
  const terms = searchTerms(query);
  const ranked: Array<{ entry: IconEntry; rank: number }> = [];
  for (const entry of entries) {
    if (category && !entry.categories.includes(category)) continue;
    const rank = rankEntry(entry, terms);
    if (rank >= 0) ranked.push({ entry, rank });
  }
  if (terms.length === 0) return ranked.map(({ entry }) => entry);
  return ranked
    .sort(
      (left, right) =>
        left.rank - right.rank || left.entry.name.length - right.entry.name.length,
    )
    .map(({ entry }) => entry);
}
