import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { rootAttributes, styles } from "../icon-styles.mjs";
import {
  runtimePolicySource,
  svgElementTypeSource,
} from "./runtime-policy.mjs";

export async function prepareDist(dist) {
  await rm(dist, { recursive: true, force: true });
  await mkdir(path.join(dist, "icons"), { recursive: true });
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

export { svgElementTypeSource };

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

export function iconExports(icons, prefix = "./icons/") {
  return icons
    .map(
      ({ componentName, name }) =>
        `export { default as ${componentName}, default as ${componentName}Icon, default as Vadivam${componentName} } from "${prefix}${name}.js";`,
    )
    .join("\n");
}

export function iconImports(icons, prefix = "./icons/") {
  return icons
    .map(
      ({ componentName, name }) =>
        `import ${componentName} from "${prefix}${name}.js";`,
    )
    .join("\n");
}

export function iconRegistryEntries(icons) {
  return icons.map(({ componentName }) => `  ${componentName}`).join(",\n");
}

export function iconRegistryTypes(icons, type) {
  return icons
    .map(({ componentName }) => `  readonly ${componentName}: ${type};`)
    .join("\n");
}

export function dynamicEntries(icons, extension = "js") {
  return icons
    .map(
      ({ name }) =>
        `  ${JSON.stringify(name)}: () => import("./icons/${name}.${extension}")`,
    )
    .join(",\n");
}

export function dynamicTypes(icons, moduleType = "DynamicIconModule") {
  return icons
    .map(
      ({ name }) =>
        `  readonly ${JSON.stringify(name)}: () => Promise<${moduleType}>;`,
    )
    .join("\n");
}

export async function write(dist, relativePath, contents) {
  const output = path.join(dist, relativePath);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, contents);
}

// Each style is its own entry point with the same layout: outline at the
// package root and solid under solid/. A style's entry imports the root's
// context and runtime policy, so one provider sets every style.
const packageStyles = Object.fromEntries(
  Object.values(styles).map((style) => [style.id, { ...style, shared: style.entryDirectory ? "../" : "./" }]),
);

function camelCase(name) {
  return name.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

// The root SVG attributes of a style as an object literal, with React-style
// camelCase names when `camel` is set.
export function defaultAttributesSource(style, { camel = false } = {}) {
  const entries = Object.entries(rootAttributes(style)).map(([name, value]) => {
    const key = camel ? camelCase(name) : name;
    return `${/^[A-Za-z]+$/.test(key) ? key : JSON.stringify(key)}: ${JSON.stringify(value)}`;
  });
  return `{ ${entries.join(", ")} }`;
}

// The stroke props an outline icon takes and a solid icon does not.
export function strokePropTypes(style) {
  return style.stroked ? " strokeWidth?: string | number; absoluteStrokeWidth?: boolean;" : "";
}

// Builds `styleIcons` for every style that has icons, each into its entry.
export async function buildStyles(dist, iconsByStyle, buildEntry) {
  for (const [id, styleIcons] of Object.entries(iconsByStyle)) {
    if (!styleIcons?.length) continue;
    const style = packageStyles[id];
    await buildEntry(style.entryDirectory ? `${dist}/${style.entryDirectory}` : dist, styleIcons, style);
  }
}
