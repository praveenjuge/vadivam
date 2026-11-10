import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { canvasSize, paintAttribute, rootAttributes, styles, svgElementTypes } from "../icon-styles.mjs";
import { runtimePolicySource } from "./runtime-policy.mjs";

export async function prepareDist(dist) {
  await rm(dist, { recursive: true, force: true });
  await mkdir(path.join(dist, "icons"), { recursive: true });
}

export async function write(dist, relativePath, contents) {
  const output = path.join(dist, relativePath);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, contents);
}

export async function writeRuntimePolicy(dist) {
  await write(dist, "runtimePolicy.js", runtimePolicySource);
  await write(
    dist,
    "runtimePolicy.d.ts",
    `import type { IconNode } from "./types.js";\nexport declare function sanitizeIconNode(iconNode: unknown): IconNode;\nexport declare function sanitizePaint(value: unknown, fallback?: string): string | number;\nexport declare function sanitizeRootAttributes(attrs: unknown, allowEventFunctions?: boolean): Record<string, unknown>;\n`,
  );
}

// Svelte and Astro icons accept an iconNode prop, so they keep the node
// sanitizer and skip it only for the nodes generated with the package.
export async function writeTrustedIconNodes(dist) {
  await write(dist, "trustedIconNodes.js", `// Icon nodes generated with the package. They passed the runtime policy when\n// the package was built, so Icon renders them without sanitizing them again.\nexport const trustedIconNodes = new WeakSet();\n`);
  await write(dist, "trustedIconNodes.d.ts", `export declare const trustedIconNodes: WeakSet<object>;\n`);
}

export const svgElementTypeSource = svgElementTypes.map((tag) => JSON.stringify(tag)).join(" | ");

export function camelCase(name) {
  return name.replace(/-([a-z0-9])/g, (_match, char) => char.toUpperCase());
}

// Each style is its own entry point with the same layout: outline at the
// package root and solid under solid/. A style's entry imports the root's
// context and runtime policy, so one provider sets every style.
const packageStyles = Object.fromEntries(
  Object.values(styles).map((style) => [style.id, { ...style, shared: style.entryDirectory ? "../" : "./" }]),
);

// Builds `styleIcons` for every style that has icons, each into its entry.
export async function buildStyles(dist, iconsByStyle, buildEntry) {
  for (const [id, styleIcons] of Object.entries(iconsByStyle)) {
    if (!styleIcons?.length) continue;
    const style = packageStyles[id];
    await buildEntry(style.entryDirectory ? `${dist}/${style.entryDirectory}` : dist, styleIcons, style);
  }
}

// The render contract every framework package follows. An icon's root carries
// its style's root attributes; the color goes to the paint attribute (an
// outline icon's stroke, a solid icon's fill) and only an outline icon takes a
// stroke width, which an absolute stroke width scales by the rendered size.
// The root's classes are `vadivam vadivam-<name>` and then the provider's and
// the caller's, without repeats. An icon with a title, a role, or an aria-*
// attribute is labelled; any other icon is hidden from assistive technology.

export const defaultSize = canvasSize;
export const defaultStrokeWidth = styles.outline.paint["stroke-width"];

/**
 * The root attributes an icon sets at render time, as [name, expression]
 * pairs: the color, and for an outline icon its stroke width scaled by
 * `scaledStrokeWidth` (see scaledStrokeWidthSource).
 */
export function paintBindings(style, { color, strokeWidth, size, absolute }) {
  const bindings = [[paintAttribute(style), color]];
  if (style.stroked) bindings.push(["stroke-width", `scaledStrokeWidth(${strokeWidth}, ${size}, ${absolute})`]);
  return bindings;
}

function propertyKey(name) {
  return /^[A-Za-z]+$/.test(name) ? name : JSON.stringify(name);
}

/** Bindings as object literal entries, with React-style names when `camel` is set. */
export function objectEntries(bindings, { camel = false } = {}) {
  return bindings.map(([name, value]) => `${propertyKey(camel ? camelCase(name) : name)}: ${value}`).join(", ");
}

/**
 * A style's root attributes as markup, with the expression of each binding in
 * place of its value: `{expression}` for JSX, or `${expression}` with `bind`.
 */
export function rootAttributeMarkup(style, bindings, { camel = false, bind = (expression) => `{${expression}}`, separator = " " } = {}) {
  const bound = new Map(bindings);
  return Object.entries(rootAttributes(style))
    .map(([name, value]) => `${camel ? camelCase(name) : name}=${bound.has(name) ? bind(bound.get(name)) : JSON.stringify(String(value))}`)
    .join(separator);
}

// The root attributes of a style as an object literal, with React-style
// camelCase names when `camel` is set.
export function defaultAttributesSource(style, { camel = false } = {}) {
  const entries = Object.entries(rootAttributes(style)).map(([name, value]) => [name, JSON.stringify(value)]);
  return `{ ${objectEntries(entries, { camel })} }`;
}

// The stroke props an outline icon takes and a solid icon does not.
export function strokePropTypes(style) {
  return style.stroked ? " strokeWidth?: string | number; absoluteStrokeWidth?: boolean;" : "";
}

// The contract's rules as functions each generator inlines into the runtime
// it writes, typed for the TypeScript-based ones.
export function mergeClassesSource({ typeScript = false } = {}) {
  const [values, result] = typeScript ? [": unknown[]", ": string"] : ["", ""];
  return `function mergeClasses(...values${values})${result} { return values.flatMap((value) => typeof value === "string" ? value.split(/\\s+/) : []).filter((value, index, all) => value && all.indexOf(value) === index).join(" "); }`;
}

export function isLabelledSource({ typeScript = false } = {}) {
  const [title, names, result] = typeScript ? [": unknown", ": string[]", ": boolean"] : ["", "", ""];
  return `function isLabelled(title${title}, attributeNames${names})${result} { return Boolean(title) || attributeNames.some((name) => name.startsWith("aria-") || name === "role" || name === "title"); }`;
}

export function scaledStrokeWidthSource({ typeScript = false } = {}) {
  const [value, absolute, result] = typeScript ? [": string | number", ": unknown", ": string | number"] : ["", "", ""];
  return `function scaledStrokeWidth(strokeWidth${value}, size${value}, absolute${absolute})${result} { const numericSize = Number(size); const numericStroke = Number(strokeWidth); return absolute && Number.isFinite(numericSize) && numericSize !== 0 && Number.isFinite(numericStroke) ? numericStroke * ${canvasSize} / numericSize : strokeWidth; }`;
}

// Every icon is exported under its component name and two aliases, as the
// matching Lucide packages do: Activity, ActivityIcon, and VadivamActivity.
export const iconAliases = Object.freeze([["", ""], ["", "Icon"], ["Vadivam", ""]]);

export function iconExportNames(componentName) {
  return iconAliases.map(([prefix, suffix]) => `${prefix}${componentName}${suffix}`);
}

export function iconNameType(icons) {
  return icons.map(({ name }) => JSON.stringify(name)).join(" | ");
}

export function iconNode(icon) {
  return JSON.stringify(icon.iconNode);
}

// React renders a list of children, so its icon nodes carry a key per element.
export function keyedIconNode(icon) {
  return JSON.stringify(icon.iconNode.map(([tag, attrs], index) => [tag, { ...attrs, key: `${tag}-${index}` }]));
}

// The icon list helpers take the folder the icon modules are in and their
// extension, which is .js except for frameworks with their own module files.
const iconModule = (name, { prefix = "./icons/", extension = "js" } = {}) => `${prefix}${name}${extension ? `.${extension}` : ""}`;

export function iconExports(icons, location, aliases = iconAliases) {
  return icons
    .map(({ componentName, name }) => `export { ${aliases.map(([prefix, suffix]) => `default as ${prefix}${componentName}${suffix}`).join(", ")} } from "${iconModule(name, location)}";`)
    .join("\n");
}

export function iconImports(icons, location) {
  return icons.map(({ componentName, name }) => `import ${componentName} from "${iconModule(name, location)}";`).join("\n");
}

export function iconRegistryEntries(icons) {
  return icons.map(({ componentName }) => `  ${componentName}`).join(",\n");
}

export function iconRegistryTypes(icons, type) {
  return icons.map(({ componentName }) => `  readonly ${componentName}: ${type};`).join("\n");
}

export function dynamicEntries(icons, location) {
  return icons.map(({ name }) => `  ${JSON.stringify(name)}: () => import("${iconModule(name, location)}")`).join(",\n");
}

export function dynamicTypes(icons, moduleType = "DynamicIconModule") {
  return icons.map(({ name }) => `  readonly ${JSON.stringify(name)}: () => Promise<${moduleType}>;`).join("\n");
}

// The /dynamic entry's declarations for the packages whose DynamicIcon takes
// VadivamProps and a fallback, and the names they export: `imports` are the
// framework's type imports, `fallback` the fallback prop's type, and
// `declaration` declares DynamicIcon.
export const dynamicExports = Object.freeze(["DynamicIcon", "DynamicIconProps", "dynamicIconImports", "iconNames"]);

export function dynamicDeclarations({ imports = "", fallback, declaration }) {
  return `${imports}import type { IconName, VadivamProps } from "./types.js";\nexport interface DynamicIconProps extends VadivamProps { name: IconName; fallback?: ${fallback}; }\n${declaration}\nexport { default as dynamicIconImports, iconNames } from "./dynamicIconImports.js";\nexport default DynamicIcon;\n`;
}

// An entry module's exports as one list, written as a .js and .d.ts pair so
// the two can't drift. Each item re-exports `values` (in both files) or
// `types` (in the .d.ts only) from a module; `{ icons }` exports every icon
// under its aliases.
export function exportsSource(list, { declarations = false } = {}) {
  const lines = list.flatMap((item) => {
    if (item.icons) return [iconExports(item.icons, item.location, item.aliases)];
    if (item.values) return [`export { ${item.values.join(", ")} } from "${item.from}";`];
    return declarations ? [`export type { ${item.types.join(", ")} } from "${item.from}";`] : [];
  });
  return `${lines.join("\n")}\n`;
}

export async function writeExports(dist, name, list) {
  await write(dist, `${name}.js`, exportsSource(list));
  await write(dist, `${name}.d.ts`, exportsSource(list, { declarations: true }));
}

/** The names an export list makes public, besides its icons. */
export function exportedNames(list) {
  return list.flatMap((item) => item.values ?? item.types ?? []).map((entry) => entry.split(" as ").pop());
}
