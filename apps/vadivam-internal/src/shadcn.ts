import iconNames from "./data/shadcn-icon-names.json";
import { resolveLucideIconName } from "./lucide";

export const SHADCN_BATCH_SIZE = 20;
export const shadcnIconNames: readonly string[] = iconNames;

const uniqueNames = new Set(shadcnIconNames);
if (uniqueNames.size !== shadcnIconNames.length) {
  throw new Error("Duplicate icon name in the shadcn queue");
}

for (const iconName of shadcnIconNames) {
  if (resolveLucideIconName(iconName) !== iconName) {
    throw new Error(`Unknown or non-canonical Lucide icon in the shadcn queue: ${iconName}`);
  }
}

export function getMissingShadcnIcons(
  existingSlugs: ReadonlySet<string>,
): string[] {
  return shadcnIconNames.filter((iconName) => !existingSlugs.has(iconName));
}
