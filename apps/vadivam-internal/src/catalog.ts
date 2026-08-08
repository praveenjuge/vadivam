export const MAX_BATCH_SIZE = 100;

export interface LucideIconRanking {
  name: string;
  rank: number;
  popularity: number;
}

export interface LucideCatalog {
  icons: LucideIconRanking[];
  lucideVersion: string;
  retrievedAt: string;
  source: string;
  ranking: string;
}

export type IconNameResolver = (value: string) => string | null;

function safeInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`Invalid ${field} in Lucide catalog`);
  }
  return value as number;
}

function requiredString(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== "string" || value.length === 0 || value.length > 240) {
    throw new Error(`Invalid ${field} in Lucide catalog`);
  }
  return value;
}

export function parseLucideCatalog(
  input: unknown,
  resolveName: IconNameResolver,
): LucideCatalog {
  if (!input || typeof input !== "object") {
    throw new Error("Lucide catalog must be an object");
  }

  const record = input as Record<string, unknown>;
  if (
    !Array.isArray(record.icons) ||
    record.icons.length === 0 ||
    record.icons.length > 10_000
  ) {
    throw new Error("Lucide catalog has an invalid icons array");
  }

  const icons: LucideIconRanking[] = [];
  const uniqueNames = new Set<string>();
  for (const item of record.icons) {
    if (!item || typeof item !== "object") {
      throw new Error("Lucide catalog contains an invalid icon");
    }
    const icon = item as Record<string, unknown>;
    if (
      typeof icon.name !== "string" ||
      icon.name.length === 0 ||
      icon.name.length > 80 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(icon.name)
    ) {
      throw new Error("Lucide catalog contains an invalid icon name");
    }

    if (resolveName(icon.name) !== icon.name) {
      throw new Error("Lucide catalog contains a non-canonical icon name");
    }
    if (uniqueNames.has(icon.name)) {
      throw new Error("Lucide catalog contains a duplicate icon name");
    }
    uniqueNames.add(icon.name);
    icons.push({
      name: icon.name,
      rank: safeInteger(icon.rank, "rank"),
      popularity: safeInteger(icon.popularity, "popularity"),
    });
  }

  icons.sort((left, right) => left.rank - right.rank);
  for (const [index, icon] of icons.entries()) {
    if (icon.rank !== index + 1) {
      throw new Error("Lucide catalog ranks must be contiguous");
    }
    const previous = icons[index - 1];
    if (previous && previous.popularity < icon.popularity) {
      throw new Error("Lucide catalog is not sorted by popularity");
    }
  }

  return {
    icons,
    lucideVersion: requiredString(record, "lucideVersion"),
    retrievedAt: requiredString(record, "retrievedAt"),
    source: requiredString(record, "source"),
    ranking: requiredString(record, "ranking"),
  };
}

export function getMissingIcons(
  icons: readonly LucideIconRanking[],
  existingNames: ReadonlySet<string>,
): LucideIconRanking[] {
  return icons.filter((icon) => !existingNames.has(icon.name));
}

export function parseBatchSize(value: unknown): number {
  if (!Number.isInteger(value)) throw new Error("Batch size must be an integer");
  return Math.min(MAX_BATCH_SIZE, Math.max(1, value as number));
}
