// Lucide's drawing of an icon, rendered at build time for the comparison on
// each icon page. The `lucide` devDependency is pinned to the release in
// metadata/lucide.json, so both sides show the same icon name.
import { icons } from "lucide";
import lucidePackage from "lucide/package.json";

export const lucideVersion: string = lucidePackage.version;

const escapeAttribute = (value: unknown) =>
  String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char);

/** Lucide's SVG for a Vadivam component name, or null when Lucide has none. */
export function lucideSvg(componentName: string, size = 24): string | null {
  const node = (icons as Record<string, [string, Record<string, unknown>][]>)[componentName];
  if (!node) return null;
  const children = node
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([name, value]) => `${name}="${escapeAttribute(value)}"`).join(" ")}/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${children}</svg>`;
}
