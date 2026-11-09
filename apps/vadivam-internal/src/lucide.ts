import deprecatedAliases from "../../../metadata/lucide-aliases.json";
import lucideRankings from "../../../metadata/lucide-rankings.json";
import { iconNames } from "../../figma-shared/names";

export type LucideIconRanking = (typeof lucideRankings.icons)[number];

export const lucideVersion = lucideRankings.lucideVersion;

/** Every current Lucide icon, most popular first. */
export const rankedLucideIcons: readonly LucideIconRanking[] = lucideRankings.icons;

export const lucideIconNames: readonly string[] = rankedLucideIcons.map(({ name }) => name).sort();

export const lucideNames = iconNames(lucideIconNames, deprecatedAliases);
