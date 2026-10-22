import { icons } from "vadivam/manifest";

type Icon = (typeof icons)[number];

interface Profile {
  icon: Icon;
  words: Set<string>;
  tags: Set<string>;
  categories: Set<string>;
}

// Built once per build and shared by every icon page.
let profiles: Profile[] | undefined;

const profile = (icon: Icon): Profile => ({
  icon,
  words: new Set(icon.name.split("-")),
  tags: new Set(icon.tags),
  categories: new Set(icon.categories),
});

const overlap = (left: Set<string>, right: Set<string>) => {
  let count = 0;
  for (const value of left) if (right.has(value)) count += 1;
  return count;
};

/**
 * Icons a reader of `name`'s page is likely to want next: variants sharing its
 * base word (`bell`, `bell-ring`, `bell-off`) rank first, then icons sharing
 * name words, tags, and categories.
 */
export function relatedIcons(name: string, limit = 18): Icon[] {
  profiles ??= icons.map(profile);
  const source = profiles.find((entry) => entry.icon.name === name);
  if (!source) return [];
  const base = name.split("-")[0];
  return profiles
    .filter((entry) => entry !== source)
    .map((entry) => {
      const score =
        (entry.icon.name.split("-")[0] === base ? 6 : 0) +
        overlap(source.words, entry.words) * 3 +
        Math.min(overlap(source.tags, entry.tags), 4) +
        overlap(source.categories, entry.categories);
      return { icon: entry.icon, score };
    })
    .filter(({ score }) => score >= 3)
    .sort((left, right) => right.score - left.score || left.icon.name.localeCompare(right.icon.name))
    .slice(0, limit)
    .map(({ icon }) => icon);
}
