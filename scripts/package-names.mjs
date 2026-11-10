// What each package calls a style's icons: the names the generators write and
// the copy formats in snippets.mjs show. Browser-safe: imports only the icon
// contract. The MCP server ships a copy.
import { pascalCase } from "./icon-styles.mjs";

const joined = (separator, ...parts) => parts.filter(Boolean).join(separator);

/** A style's entry in a JavaScript package: `vadivam-react`, `vadivam-react/solid`. */
export function styleEntry(packageName, style) {
  return joined("/", packageName, style.entryDirectory);
}

/** Angular: what a style's directive selectors start with, `vadivam` or `vadivamSolid`. */
export function angularSelectorPrefix(style) {
  return `vadivam${pascalCase(style.entryDirectory)}`;
}

/** Flutter and Compose: what holds a style's icons, `VadivamIcons` or `VadivamSolidIcons`. */
export function iconsOwner(style) {
  return `Vadivam${pascalCase(style.entryDirectory)}Icons`;
}

/** Flutter: an icon's constant in its style's class, its component name in lowerCamelCase: `arrowRight`. */
export function dartIconName(componentName) {
  return componentName[0].toLowerCase() + componentName.slice(1);
}

/** Compose: the Kotlin package of a style's icons. */
export function composePackage(style) {
  return joined(".", "com.praveenjuge.vadivam.icons", style.entryDirectory);
}

/** shadcn: a style's registry item under the site, such as `r/solid/house.json`. */
export function shadcnItemPath(name, style) {
  return joined("/", "r", style.entryDirectory, `${name}.json`);
}
