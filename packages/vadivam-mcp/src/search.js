import { categories, iconRanks, icons } from "./data.js";
import { siteUrl } from "./snippets.js";

export const iconsByName = new Map(icons.map((icon) => [icon.name, icon]));
const iconsByComponentName = new Map(
  icons.map((icon) => [icon.componentName.toLowerCase(), icon]),
);
export const categoriesById = new Map(
  categories.map((category) => [category.id, category]),
);

const maxTags = 8;

function normalize(value) {
  return String(value ?? "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase();
}

function tokenize(value) {
  return normalize(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Look up an icon by kebab name or component name (`arrow-right`, `ArrowRight`, `ArrowRightIcon`). */
export function findIcon(name) {
  const raw = String(name ?? "").trim();
  const kebab = tokenize(raw).join("-");
  const compact = raw.replace(/[\s_-]+/g, "").toLowerCase();
  return (
    iconsByName.get(raw) ??
    iconsByName.get(kebab) ??
    iconsByComponentName.get(compact) ??
    iconsByComponentName.get(compact.replace(/^vadivam/, "").replace(/icon$/, ""))
  );
}

/** Resolve a category by id or title, case-insensitively. */
export function findCategory(value) {
  const key = normalize(value);
  return categories.find(
    (category) => category.id === key || category.title.toLowerCase() === key,
  );
}

// Words for every icon, computed once per process.
const searchTerms = new Map(
  icons.map((icon) => [
    icon,
    {
      nameWords: icon.name.split("-"),
      tagWords: icon.tags.flatMap(tokenize),
      categoryWords: icon.categories.flatMap((id) => [
        id,
        ...tokenize(categoriesById.get(id)?.title),
      ]),
    },
  ]),
);

function tokenScore(icon, terms, token) {
  if (terms.nameWords.includes(token)) return 500;
  if (terms.nameWords.some((word) => word.startsWith(token))) return 400;
  if (icon.name.includes(token)) return 300;
  if (icon.tags.includes(token)) return 250;
  if (terms.tagWords.includes(token)) return 200;
  if (terms.tagWords.some((word) => word.startsWith(token))) return 150;
  if (terms.categoryWords.some((word) => word.startsWith(token))) return 50;
  return 0;
}

/**
 * Score one icon for a query. Exact names rank first, then name prefixes and
 * name words, then tags, then category titles. Every query word must match
 * somewhere, otherwise the icon scores 0.
 */
export function scoreIcon(icon, query) {
  const tokens = tokenize(query);
  // Symbol-only queries (`€`, `->|`, `@`) have no word tokens, but Lucide
  // ships them as tags, so match them exactly.
  if (tokens.length === 0) return icon.tags.includes(normalize(query)) ? 250 : 0;
  const phrase = tokens.join("-");
  if (icon.name === phrase || icon.componentName.toLowerCase() === tokens.join("")) {
    return 10_000;
  }
  const terms = searchTerms.get(icon);
  let score = 0;
  for (const token of tokens) {
    const value = tokenScore(icon, terms, token);
    if (value === 0) return 0;
    score += value;
  }
  if (icon.name.startsWith(phrase)) score += 2_000;
  else if (tokens.length > 1 && icon.name.includes(phrase)) score += 1_000;
  else if (tokens.length > 1 && icon.tags.includes(tokens.join(" "))) score += 600;
  return score;
}

/** The compact shape returned to agents. */
export function iconSummary(icon) {
  return {
    name: icon.name,
    componentName: icon.componentName,
    categories: icon.categories,
    tags: icon.tags.slice(0, maxTags),
    url: `${siteUrl}/icons/${icon.name}`,
  };
}

/**
 * Ranked icon search over names, component names, tags, and category titles.
 * An empty query with a category lists that category alphabetically.
 */
export function searchIcons(query, { limit = 20, category } = {}) {
  const count = Math.min(Math.max(Math.trunc(Number(limit) || 20), 1), 100);
  let pool = icons;
  let categoryId;
  if (category !== undefined && category !== null && String(category).trim() !== "") {
    const match = findCategory(category);
    if (!match) {
      throw new Error(
        `Unknown category "${category}". Use list_categories to see the ${categories.length} category ids.`,
      );
    }
    categoryId = match.id;
    pool = icons.filter((icon) => icon.categories.includes(categoryId));
  }
  let ranked;
  if (normalize(query) === "") {
    // Browsing a category: alphabetical.
    ranked = categoryId
      ? [...pool].sort((a, b) => a.name.localeCompare(b.name)).map((icon) => ({ icon }))
      : [];
  } else {
    ranked = pool
      .map((icon) => ({ icon, score: scoreIcon(icon, query) }))
      .filter(({ score }) => score > 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.icon.name.length - b.icon.name.length ||
          a.icon.name.localeCompare(b.icon.name),
      );
  }
  return {
    query: String(query ?? ""),
    ...(categoryId ? { category: categoryId } : {}),
    total: ranked.length,
    results: ranked.slice(0, count).map(({ icon }) => iconSummary(icon)),
  };
}

function editDistance(a, b) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[b.length];
}

/** Up to `limit` real icon names closest to an unknown one: search hits first, then spelling. */
export function closestIconNames(name, limit = 5) {
  const names = searchIcons(name, { limit }).results.map((icon) => icon.name);
  if (names.length < limit) {
    const target = tokenize(name).join("-");
    const bySpelling = icons
      .filter((icon) => !names.includes(icon.name))
      .map((icon) => ({ name: icon.name, distance: editDistance(target, icon.name) }))
      .sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name));
    for (const { name: candidate } of bySpelling) {
      if (names.length >= limit) break;
      names.push(candidate);
    }
  }
  return names;
}

// Words that describe where an icon goes rather than what it shows.
const fillerWords = new Set([
  "a", "an", "the", "my", "our", "your", "this", "that", "some", "each", "every",
  "of", "in", "on", "at", "by", "for", "to", "from", "into", "as",
  "page", "pages", "screen", "screens", "view", "section", "panel", "button", "buttons",
  "icon", "icons", "ui", "app", "component", "components", "link", "links", "item", "items",
  "show", "shows", "showing", "need", "needs", "want", "use", "using",
]);
const maxConcepts = 12;

// "notifications" -> "notification", "boxes" -> "box", but not "glass" or "bus".
const singular = (word) => word.replace(/(?:(?<=(?:x|ch|sh|ss))es|(?<=[^su])s)$/, "");

/**
 * Ranked icons for one concept. Unlike search_icons, a concept also matches its
 * singular form, an icon whose name holds every word ranks first (cart ->
 * shopping-cart before carton), and Lucide's popularity breaks ties.
 */
function searchConcept(words, limit) {
  const variants = [...new Set([words.join(" "), words.map(singular).join(" ")])];
  return icons
    .map((icon) => {
      const nameWords = searchTerms.get(icon).nameWords;
      const score = Math.max(
        ...variants.map((variant) => {
          const value = scoreIcon(icon, variant);
          return value > 0 && variant.split(" ").every((word) => nameWords.includes(word)) ? value + 3_000 : value;
        }),
      );
      return { icon, score };
    })
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (iconRanks[a.icon.name] ?? Infinity) - (iconRanks[b.icon.name] ?? Infinity) ||
        a.icon.name.length - b.icon.name.length ||
        a.icon.name.localeCompare(b.icon.name),
    )
    .slice(0, limit)
    .map(({ icon }) => iconSummary(icon));
}

/**
 * Icons for each thing a UI description mentions. The description is split on
 * commas, "and", "with", and similar joins; each part is searched as a phrase,
 * then word by word when the phrase as a whole matches nothing.
 */
export function suggestIcons(description, { perConcept = 3 } = {}) {
  const limit = Math.min(Math.max(Math.trunc(Number(perConcept) || 3), 1), 10);
  const parts = String(description ?? "")
    .split(/[,;\n.!?:/|+&()]|\s(?:and|or|with|plus|then|also)\s/i)
    .map((part) => tokenize(part).filter((word) => !fillerWords.has(word)))
    .filter((words) => words.length > 0);
  const concepts = [];
  const unmatched = [];
  const seen = new Set();
  const add = (words) => {
    const concept = words.join(" ");
    if (seen.has(concept) || concepts.length >= maxConcepts) return;
    seen.add(concept);
    const results = searchConcept(words, limit);
    if (results.length > 0) concepts.push({ concept, results });
    else unmatched.push(concept);
  };
  for (const words of parts) {
    if (words.length === 1 || searchConcept(words, 1).length > 0) add(words);
    else for (const word of words) add([word]);
  }
  return { description: String(description ?? ""), concepts, unmatched };
}
