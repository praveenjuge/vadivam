import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
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
    `import type { IconNode } from "./types.js";\nexport declare function sanitizeIconNode(iconNode: unknown): IconNode;\nexport declare function sanitizeRootAttributes(attrs: unknown, allowEventFunctions?: boolean): Record<string, unknown>;\n`,
  );
}

export { svgElementTypeSource };

export function iconNameType(icons) {
  return icons.map(({ name }) => JSON.stringify(name)).join(" | ");
}

export function iconNode(icon) {
  return JSON.stringify(
    icon.iconNode.map(([tag, attrs]) => [
      tag,
      Object.fromEntries(
        Object.entries(attrs).filter(([name]) => name !== "key"),
      ),
    ]),
  );
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

export const defaultAttributes = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};
