// Icon search for the docs homepage and the Figma plugin. Every query word
// must match, and an icon ranks by its weakest word: exact name, name prefix,
// name word, tag prefix, tag, category, then (with `typos`) a near-miss name.
// Browser-safe, with no Figma globals.
import { editDistance } from "./names";

export interface SearchEntry {
  name: string;
  /** The name without hyphens, so component names like `ArrowUp` match. */
  compact: string;
  /** The name with spaces for hyphens. */
  words: string;
  tags: readonly string[];
  /** Category ids, for the category filter. */
  categories: readonly string[];
  /** Lowercase category titles, for matching words. */
  categoryTitles: readonly string[];
}

export interface SearchOptions {
  /** Only icons in this category id. */
  category?: string;
  /**
   * Match names with only the letters, digits, and hyphens of a word, and
   * compare hyphen-free names with hyphen-free words, so `arrow_down` and
   * `ArrowDown01` find `arrow-down-0-1`.
   */
  looseNames?: boolean;
  /** Also match names one or two typos away, after every other match. */
  typos?: boolean;
  /** Among equal ranks, list shorter names first. */
  shortestFirst?: boolean;
}

/** An icon name's search fields. */
export function nameFields(name: string): Pick<SearchEntry, "name" | "compact" | "words"> {
  return { name, compact: name.replace(/-/g, ""), words: name.replace(/-/g, " ") };
}

// Words keep their symbols so tags like `$`, `@`, or `->|` stay searchable.
export function searchTerms(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

// Names only hold letters, digits, and hyphens.
const nameTerm = (term: string, { looseNames }: SearchOptions) => (looseNames ? term.replace(/[^a-z0-9-]/g, "") : term);

// Lower ranks sort first.
function termRank(entry: SearchEntry, term: string, options: SearchOptions): number {
  const name = nameTerm(term, options);
  const compactTerm = options.looseNames ? name.replace(/-/g, "") : term;
  if (compactTerm) {
    if (entry.name === name || entry.compact === compactTerm) return 0;
    if (entry.name.startsWith(name) || entry.compact.startsWith(compactTerm)) return 1;
    if (entry.name.includes(name) || entry.words.includes(name) || entry.compact.includes(compactTerm)) return 2;
  }
  // The raw word keeps symbol tags like `$`; the name word drops stray punctuation like `sort,`.
  const words = name && name !== term ? [term, name] : [term];
  if (entry.tags.some((tag) => words.some((word) => tag.startsWith(word)))) return 3;
  if (entry.tags.some((tag) => words.some((word) => tag.includes(word)))) return 4;
  if (entry.categoryTitles.some((title) => words.some((word) => title.includes(word)))) return 5;
  if (!options.typos) return -1;
  const limit = compactTerm.length >= 7 ? 2 : 1;
  return compactTerm.length >= 3 && editDistance(entry.compact, compactTerm, limit) <= limit ? 6 : -1;
}

/** An entry's rank for the query words, or -1 when it doesn't match. */
export function rankEntry(entry: SearchEntry, terms: readonly string[], options: SearchOptions = {}): number {
  if (options.category && !entry.categories.includes(options.category)) return -1;
  if (terms.length === 0) return 0;
  // Joined words like `arrow down` match hyphenated names only when every word is a name word.
  const nameTerms = terms.map((term) => nameTerm(term, options));
  const joined = nameTerms.join("-");
  if (terms.length > 1 && nameTerms.every(Boolean) && entry.name.includes(joined)) {
    return entry.name === joined ? 0 : entry.name.startsWith(joined) ? 1 : 2;
  }
  let rank = 0;
  for (const term of terms) {
    const termRanked = termRank(entry, term, options);
    if (termRanked < 0) return -1;
    rank = Math.max(rank, termRanked);
  }
  return rank;
}

/** The entries matching a query, best first; equal ranks keep the entries' order. */
export function searchIcons<Entry extends SearchEntry>(entries: readonly Entry[], query: string, options: SearchOptions = {}): Entry[] {
  const terms = searchTerms(query);
  const ranked: Array<{ entry: Entry; rank: number }> = [];
  for (const entry of entries) {
    const rank = rankEntry(entry, terms, options);
    if (rank >= 0) ranked.push({ entry, rank });
  }
  const byLength = options.shortestFirst && terms.length > 0;
  return ranked
    .sort((left, right) => left.rank - right.rank || (byLength ? left.entry.name.length - right.entry.name.length : 0))
    .map(({ entry }) => entry);
}
