// lucide.dev can trail the newest release by a few days. More unlisted icons
// than this means the site data changed shape rather than just lagging.
export const MAX_UNLISTED_ICONS = 25;

const simpleEscapes: Record<string, string> = {
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
export function decodeStringLiteral(source: string, quoteIndex: number): string {
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
      if (!/^[0-9a-f]{4,6}$/i.test(hex)) {
        throw new Error("Invalid Unicode escape in Lucide data");
      }
      result += String.fromCodePoint(Number.parseInt(hex, 16));
      index = end;
      continue;
    }
    if (escaped === "\n" || escaped === "\r") continue;
    throw new Error(`Unsupported escape in Lucide data: \\${escaped}`);
  }
  throw new Error("Unterminated Lucide icon data string");
}

export interface RankedLucideIcon {
  name: string;
  popularity: number;
  rank: number;
}

// Ranks every canonical icon by lucide.dev popularity, most popular first.
export function rankLucideIcons(
  canonicalNames: readonly string[],
  deprecatedAliases: ReadonlyMap<string, string>,
  sitePopularity: ReadonlyMap<string, number>,
): { icons: RankedLucideIcon[]; unlisted: string[] } {
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
