// Lucide's drawing of an icon, rendered at build time for the comparison on
// each icon page. The `lucide` devDependency is pinned to the release in
// metadata/lucide.json, so both sides show the same icon name.
import { icons } from "lucide";
import lucidePackage from "lucide/package.json";
import { rootTag, styles } from "../../../../scripts/icon-styles.mjs";
import { escapeHtml } from "./icon-tools";

export const lucideVersion: string = lucidePackage.version;

/** Lucide's 24px SVG for a Vadivam component name, or null when Lucide has none. */
export function lucideSvg(componentName: string): string | null {
  const node = (icons as Record<string, [string, Record<string, unknown>][]>)[componentName];
  if (!node) return null;
  const children = node
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([name, value]) => `${name}="${escapeHtml(value)}"`).join(" ")}/>`)
    .join("");
  return `${rootTag(styles.outline)}${children}</svg>`;
}
