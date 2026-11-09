import lucideMetadata from "../../../metadata/lucide.json";
import { editDistance, layerNameKey, withoutAffixes } from "../../figma-shared/names";
import { lucideIconNames, lucideNames, rankedLucideIcons } from "./lucide";
import type { RenameReason } from "./protocol";

const MAX_RENAME_IDEAS = 3;

export interface RenameIdea {
  name: string;
  reason: RenameReason;
}

const iconNameSet = new Set(lucideIconNames);
const popularityRank = new Map(rankedLucideIcons.map((icon) => [icon.name, icon.rank] as const));
const tagsByIcon = new Map<string, readonly string[]>(
  Object.entries(lucideMetadata.icons).map(([name, { tags }]) => [name, tags]),
);

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
    const tagKey = layerNameKey(tag);
    if (tagKey) namesByTag.set(tagKey, [...(namesByTag.get(tagKey) ?? []), name]);
  }
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

  const ideas = new Map<string, RenameReason>();
  const add = (name: string | null, reason: RenameReason): void => {
    if (name && !ideas.has(name) && ideas.size < MAX_RENAME_IDEAS) {
      ideas.set(name, reason);
    }
  };

  add(lucideNames.current(value), "format");
  add(lucideNames.replacement(value), "deprecated");
  if (ideas.size > 0) return [...ideas].map(([name, reason]) => ({ name, reason }));

  const key = withoutAffixes(layerNameKey(value));
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
