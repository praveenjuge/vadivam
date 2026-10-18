import iconTags from "./data/lucide-icon-tags.json";
import lucideRankings from "./data/lucide-icon-rankings.json";
import {
  getDeprecatedLucideReplacement,
  lucideIconNames,
  resolveLucideIconName,
} from "./lucide";
import type { RenameReason } from "./protocol";

export const MAX_RENAME_IDEAS = 3;

export interface RenameIdea {
  name: string;
  reason: RenameReason;
}

const iconNameSet = new Set(lucideIconNames);
const popularityRank = new Map(
  lucideRankings.icons.map((icon) => [icon.name, icon.rank] as const),
);
const tagsByIcon = new Map<string, readonly string[]>(Object.entries(iconTags));

function byPopularity(left: string, right: string): number {
  return (
    (popularityRank.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (popularityRank.get(right) ?? Number.MAX_SAFE_INTEGER) ||
    left.localeCompare(right)
  );
}

function tokenKey(name: string): string {
  return name.split("-").sort().join("-");
}

const namesByTokenKey = new Map<string, string[]>();
const namesByTag = new Map<string, string[]>();
for (const name of lucideIconNames) {
  const key = tokenKey(name);
  namesByTokenKey.set(key, [...(namesByTokenKey.get(key) ?? []), name]);
  for (const tag of tagsByIcon.get(name) ?? []) {
    const tagKey = toKebabName(tag);
    if (tagKey) namesByTag.set(tagKey, [...(namesByTag.get(tagKey) ?? []), name]);
  }
}

/** Converts layer names like "Icon=ArrowRight", "arrow_right" or "Arrow Right" to kebab case. */
export function toKebabName(value: string): string {
  const base = value.split(/[/=]/).pop() ?? value;
  return base
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function withoutAffixes(name: string): string {
  return name
    .replace(/^lucide-/, "")
    .replace(/-copy-\d+$/, "")
    .replace(/-copy$/, "")
    .replace(/-icon$/, "");
}

function editDistance(left: string, right: string, limit: number): number {
  if (Math.abs(left.length - right.length) > limit) return limit + 1;
  let previousPrevious: number[] = [];
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    let rowMinimum = i;
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      let value = Math.min(
        (previous[j] as number) + 1,
        (current[j - 1] as number) + 1,
        (previous[j - 1] as number) + cost,
      );
      if (
        i > 1 &&
        j > 1 &&
        left[i - 1] === right[j - 2] &&
        left[i - 2] === right[j - 1]
      ) {
        value = Math.min(value, (previousPrevious[j - 2] as number) + 1);
      }
      current.push(value);
      rowMinimum = Math.min(rowMinimum, value);
    }
    if (rowMinimum > limit) return limit + 1;
    previousPrevious = previous;
    previous = current;
  }
  return previous[right.length] as number;
}

function spellingMatches(name: string): string[] {
  const limit = name.length <= 4 ? 1 : name.length <= 9 ? 2 : 3;
  return lucideIconNames
    .map((candidate) => ({ candidate, distance: editDistance(name, candidate, limit) }))
    .filter((match) => match.distance <= limit)
    .sort(
      (left, right) =>
        left.distance - right.distance || byPopularity(left.candidate, right.candidate),
    )
    .map((match) => match.candidate);
}

function similarMatches(name: string): string[] {
  const tokens = new Set(name.split("-").filter((token) => token.length >= 3));
  if (tokens.size === 0) return [];
  return lucideIconNames
    .map((candidate) => {
      const candidateTokens = candidate.split("-");
      const shared = candidateTokens.filter((token) => tokens.has(token)).length;
      return {
        candidate,
        score: shared / Math.max(tokens.size, candidateTokens.length),
      };
    })
    .filter((match) => match.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score || byPopularity(left.candidate, right.candidate),
    )
    .map((match) => match.candidate);
}

/**
 * Suggests current Lucide names for a layer name. Returns no ideas when the
 * name is already canonical, and only exact ideas when one exists.
 */
export function suggestRenameIdeas(value: string): RenameIdea[] {
  if (iconNameSet.has(value)) return [];
  const trimmed = value.trim();

  const ideas = new Map<string, RenameReason>();
  const add = (name: string | null, reason: RenameReason): void => {
    if (name && !ideas.has(name) && ideas.size < MAX_RENAME_IDEAS) {
      ideas.set(name, reason);
    }
  };

  const kebab = toKebabName(trimmed);
  const variants = [...new Set([trimmed, kebab, withoutAffixes(kebab)])].filter(Boolean);
  for (const variant of variants) {
    add(resolveLucideIconName(variant), "format");
    add(getDeprecatedLucideReplacement(variant), "deprecated");
  }
  const exact = [...ideas].map(([name, reason]) => ({ name, reason }));
  if (exact.length > 0) return exact;

  const key = variants[variants.length - 1];
  if (!key) return [];
  // Take the best match from each kind first so one kind can't crowd out the
  // others; loosely similar names only fill the slots left over.
  const groups: Array<[RenameReason, string[]]> = [
    ["reordered", [...(namesByTokenKey.get(tokenKey(key)) ?? [])].sort(byPopularity)],
    ["tag", [...(namesByTag.get(key) ?? [])].sort(byPopularity)],
    ["spelling", spellingMatches(key)],
  ];
  while (ideas.size < MAX_RENAME_IDEAS && groups.some(([, names]) => names.length > 0)) {
    for (const [reason, names] of groups) add(names.shift() ?? null, reason);
  }
  for (const name of similarMatches(key)) add(name, "similar");
  return [...ideas].map(([name, reason]) => ({ name, reason }));
}
