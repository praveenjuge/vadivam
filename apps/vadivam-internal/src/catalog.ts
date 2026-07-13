export const MAX_BATCH_SIZE = 100;

export interface PopularIcon {
  name: string;
  slug: string;
  rank: number;
  repositories: number;
  files: number;
}

export interface PopularFeed {
  icons: PopularIcon[];
  scannedAt: string | null;
  methodology: string | null;
}

export type IconNameResolver = (value: string) => string | null;

export function toIconSlug(value: string): string {
  return value
    .trim()
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Za-z])(\d)/g, "$1-$2")
    .replace(/(\d)([A-Za-z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function safeInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`Invalid ${field} in popular icon feed`);
  }
  return value as number;
}

export function parsePopularFeed(
  input: unknown,
  resolveName: IconNameResolver = toIconSlug,
): PopularFeed {
  if (!input || typeof input !== "object") {
    throw new Error("Popular icon feed must be an object");
  }

  const record = input as Record<string, unknown>;
  if (!Array.isArray(record.icons) || record.icons.length > 10_000) {
    throw new Error("Popular icon feed has an invalid icons array");
  }

  const unique = new Map<string, PopularIcon>();
  for (const item of record.icons) {
    if (!item || typeof item !== "object") {
      throw new Error("Popular icon feed contains an invalid icon");
    }
    const icon = item as Record<string, unknown>;
    if (
      typeof icon.name !== "string" ||
      icon.name.length === 0 ||
      icon.name.length > 80 ||
      !/^[A-Za-z][A-Za-z0-9-]*$/.test(icon.name)
    ) {
      throw new Error("Popular icon feed contains an invalid icon name");
    }

    const slug = resolveName(icon.name);
    if (!slug) throw new Error("Popular icon feed contains an unknown icon name");
    const parsed: PopularIcon = {
      name: icon.name,
      slug,
      rank: safeInteger(icon.rank, "rank"),
      repositories: safeInteger(icon.repositories, "repositories"),
      files: safeInteger(icon.files, "files"),
    };
    const previous = unique.get(parsed.slug);
    if (!previous || parsed.rank < previous.rank) unique.set(parsed.slug, parsed);
  }

  const methodology =
    record.methodology && typeof record.methodology === "object"
      ? (record.methodology as Record<string, unknown>)
      : null;

  return {
    icons: [...unique.values()].sort(
      (left, right) => left.rank - right.rank || left.slug.localeCompare(right.slug),
    ),
    scannedAt:
      methodology && typeof methodology.scannedAt === "string"
        ? methodology.scannedAt
        : null,
    methodology:
      methodology && typeof methodology.ranking === "string"
        ? methodology.ranking
        : null,
  };
}

export function getMissingIcons(
  icons: readonly PopularIcon[],
  existingSlugs: ReadonlySet<string>,
): PopularIcon[] {
  return icons.filter((icon) => !existingSlugs.has(icon.slug));
}

export function parseBatchSize(value: unknown): number {
  if (!Number.isInteger(value)) throw new Error("Batch size must be an integer");
  return Math.min(MAX_BATCH_SIZE, Math.max(1, value as number));
}
