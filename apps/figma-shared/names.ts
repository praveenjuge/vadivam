// Designers name icon layers `arrow-right`, `ArrowRight`, `arrow_right`,
// `Icon=ArrowRight`, `lucide/arrow-right`, or `arrow-right icon`; each of these
// means the icon `arrow-right`.

/** A layer name's last `/` or `=` segment in kebab case: `Icon=ArrowRight` → `arrow-right`. */
export function layerNameKey(value: string): string {
  const segment = value.split(/[/=]/).pop() ?? value;
  return segment
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** A layer name key without what Lucide and Figma add around names: `LucideSearchIcon copy` → `search`. */
export function withoutAffixes(key: string): string {
  return key
    .replace(/^lucide-/, "")
    .replace(/-copy(?:-\d+)?$/, "")
    .replace(/-icon$/, "");
}

// PascalCase drops the hyphens around digits and single letters, so
// `ArrowDown01` only matches `arrow-down-0-1` with every separator removed.
const compact = (key: string) => key.replace(/-/g, "");

interface NameTable {
  exact: ReadonlyMap<string, string>;
  /** `null` where two names compact to the same letters, like `letter-s` and `letters`. */
  compact: ReadonlyMap<string, string | null>;
}

function nameTable(entries: Iterable<readonly [string, string]>): NameTable {
  const exact = new Map<string, string>();
  const compacted = new Map<string, string | null>();
  for (const [key, name] of entries) {
    exact.set(key, name);
    const letters = compact(key);
    const previous = compacted.get(letters);
    compacted.set(letters, previous === undefined || previous === name ? name : null);
  }
  return { exact, compact: compacted };
}

function lookUp(table: NameTable, value: string): string | null {
  const key = layerNameKey(value);
  for (const candidate of new Set([key, withoutAffixes(key)])) {
    const name = table.exact.get(candidate) ?? table.compact.get(compact(candidate));
    if (name) return name;
  }
  return null;
}

export interface IconNames {
  /** The current icon a layer name spells, in any format: `ArrowRight` → `arrow-right`. */
  current(layerName: string): string | null;
  /** The current icon for a deprecated name in any format: `AlertCircle` → `circle-exclamation-point`. */
  replacement(layerName: string): string | null;
}

export function iconNames(names: Iterable<string>, deprecated: Readonly<Record<string, string>>): IconNames {
  const current = nameTable([...names].map((name) => [name, name] as const));
  const aliases = nameTable(Object.entries(deprecated));
  return {
    current: (layerName) => lookUp(current, layerName),
    replacement: (layerName) => lookUp(aliases, layerName),
  };
}

/** Edit distance counting adjacent swaps as one edit; anything over `limit` is `limit + 1`. */
export function editDistance(left: string, right: string, limit: number): number {
  if (Math.abs(left.length - right.length) > limit) return limit + 1;
  let beforePrevious: number[] = [];
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    let rowMinimum = i;
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      let value = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
      if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) {
        value = Math.min(value, beforePrevious[j - 2]! + 1);
      }
      current.push(value);
      rowMinimum = Math.min(rowMinimum, value);
    }
    if (rowMinimum > limit) return limit + 1;
    beforePrevious = previous;
    previous = current;
  }
  return Math.min(previous[right.length]!, limit + 1);
}
