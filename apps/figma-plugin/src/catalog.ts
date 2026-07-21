export interface CatalogIcon {
  name: string;
  svg: string;
  iconNode: ReadonlyArray<readonly [string, Readonly<Record<string, string>>]>;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function distance(left: string, right: string): number {
  if (left === right) return 0;
  if (left.length === 0) return right.length;
  if (right.length === 0) return left.length;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        (current[rightIndex - 1] ?? 0) + 1,
        (previous[rightIndex] ?? 0) + 1,
        (previous[rightIndex - 1] ?? 0) +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length] ?? Number.POSITIVE_INFINITY;
}

function score(name: string, query: string): number | null {
  const normalizedName = normalize(name);
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return 0;
  if (normalizedName === normalizedQuery) return 0;
  if (normalizedName.startsWith(normalizedQuery)) return 10 + normalizedName.length;

  const tokens = name.split("-");
  if (tokens.some((token) => token.startsWith(normalizedQuery))) {
    return 100 + normalizedName.length;
  }
  const substring = normalizedName.indexOf(normalizedQuery);
  if (substring >= 0) return 200 + substring * 10 + normalizedName.length;

  const typoDistance = distance(normalizedName, normalizedQuery);
  const limit = normalizedQuery.length >= 7 ? 2 : 1;
  return typoDistance <= limit ? 300 + typoDistance * 10 + normalizedName.length : null;
}

export function searchIcons(
  icons: readonly CatalogIcon[],
  query: string,
): CatalogIcon[] {
  return icons
    .map((icon) => ({ icon, score: score(icon.name, query) }))
    .filter(
      (entry): entry is { icon: CatalogIcon; score: number } =>
        entry.score !== null,
    )
    .sort(
      (left, right) =>
        left.score - right.score || left.icon.name.localeCompare(right.icon.name),
    )
    .map(({ icon }) => icon);
}
