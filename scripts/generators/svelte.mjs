import path from "node:path";
import { compile } from "svelte/compiler";
import {
  buildStyles,
  defaultAttributesSource,
  dynamicEntries,
  dynamicTypes,
  defaultSize,
  defaultStrokeWidth,
  exportedNames,
  iconExports,
  iconImports,
  iconNameType,
  iconNode,
  iconRegistryEntries,
  iconRegistryTypes,
  isLabelledSource,
  mergeClassesSource,
  paintBindings,
  prepareDist,
  scaledStrokeWidthSource,
  strokePropTypes,
  svgElementTypeSource,
  write,
  writeExports,
  writeRuntimePolicy,
  writeTrustedIconNodes,
} from "./shared.mjs";

const indexExports = (icons, shared) => [
  { icons },
  { from: "./Icon.svelte", values: ["default as Icon"] },
  { from: `${shared}VadivamProvider.svelte`, values: ["default as VadivamProvider"] },
  { from: "./createVadivamIcon.js", values: ["createVadivamIcon"] },
  { from: "./icons.js", values: ["icons"] },
  { from: `${shared}context.js`, values: ["VADIVAM_CONTEXT", "getVadivamContext", "setVadivamProps"] },
  { from: "./dynamicIconImports.js", values: ["dynamicIconImports", "iconNames"] },
  { from: "./types.js", types: ["IconDefinition", "IconName", "IconNode", "SVGElementType", "VadivamIcon", "VadivamProps"] },
];

/** Every name the root entry exports besides the icons; DynamicIcon is its own .svelte module. */
export const apiExports = exportedNames(indexExports([], "./"));

async function writeSvelte(dist, relativePath, source) {
  compile(source, { filename: relativePath, generate: "client", runes: true });
  await write(dist, relativePath, source);
}

export async function build({ iconsByStyle, directory }) {
  const dist = path.join(directory, "dist");
  await prepareDist(dist);
  await writeRuntimePolicy(dist);
  // Provider props come from the outline types, which include stroke props.
  await write(dist, "context.js", `import { getContext, setContext } from "svelte";\nexport const VADIVAM_CONTEXT = Symbol("vadivam-icons");\nexport function setVadivamProps(props) { setContext(VADIVAM_CONTEXT, props); return props; }\nexport function getVadivamContext() { return getContext(VADIVAM_CONTEXT) ?? {}; }\n`);
  await write(dist, "context.d.ts", `import type { VadivamProps } from "./types.js";\nexport declare const VADIVAM_CONTEXT: unique symbol;\nexport declare function setVadivamProps(props: Partial<VadivamProps>): Partial<VadivamProps>;\nexport declare function getVadivamContext(): Partial<VadivamProps>;\n`);
  await writeSvelte(dist, "VadivamProvider.svelte", `<script lang="ts">\n  import { setVadivamProps } from "./context.js";\n  import type { Snippet } from "svelte";\n  import type { VadivamProps } from "./types.js";\n  let { children, size, color, strokeWidth, absoluteStrokeWidth, class: className }: Partial<VadivamProps> & { children: Snippet } = $props();\n  setVadivamProps({\n    get size() { return size; },\n    get color() { return color; },\n    get strokeWidth() { return strokeWidth; },\n    get absoluteStrokeWidth() { return absoluteStrokeWidth; },\n    get class() { return className; }\n  });\n</script>\n{@render children()}\n`);
  await write(dist, "VadivamProvider.svelte.d.ts", `import type { Component, Snippet } from "svelte";\nimport type { VadivamProps } from "./types.js";\ndeclare const VadivamProvider: Component<Partial<VadivamProps> & { children: Snippet }>;\nexport default VadivamProvider;\n`);
  await buildStyles(dist, iconsByStyle, buildSvelteEntry);
}

async function buildSvelteEntry(dist, icons, style) {
  const shared = style.shared;
  const paint = paintBindings(style, {
    color: "sanitizePaint(color ?? context.color)",
    strokeWidth: `strokeWidth ?? context.strokeWidth ?? ${defaultStrokeWidth}`,
    size: "resolvedSize",
    absolute: "absoluteStrokeWidth ?? context.absoluteStrokeWidth ?? false",
  }).map(([name, value]) => `${name}={${value}}`).join(" ");
  const helpers = [mergeClassesSource, isLabelledSource, ...(style.stroked ? [scaledStrokeWidthSource] : [])].map((source) => `  ${source({ typeScript: true })}\n`).join("");
  // Each style entry trusts the nodes generated with it.
  await writeTrustedIconNodes(dist);
  await write(dist, "types.d.ts", `import type { Component, Snippet } from "svelte";\nimport type { SVGAttributes } from "svelte/elements";\nexport type SVGElementType = ${svgElementTypeSource};\nexport type IconNode = readonly [tag: SVGElementType, attrs: Record<string, string | number | boolean>][];\nexport interface VadivamProps extends ${style.stroked ? "SVGAttributes<SVGSVGElement>" : 'Omit<SVGAttributes<SVGSVGElement>, "stroke-width">'} { name?: string; size?: string | number; color?: string;${strokePropTypes(style)} title?: string; iconNode?: IconNode; children?: Snippet; }\nexport interface IconDefinition { name: string; iconNode: IconNode; }\nexport type VadivamIcon = Component<VadivamProps>;\nexport type IconName = ${iconNameType(icons)};\n`);
  await write(dist, "defaultAttributes.js", `export default ${defaultAttributesSource(style)};\n`);
  await writeSvelte(dist, "Icon.svelte", `<script module lang="ts">\n${helpers}</script>\n<script lang="ts">\n  import defaultAttributes from "./defaultAttributes.js";\n  import { sanitizeIconNode, sanitizePaint, sanitizeRootAttributes } from "${shared}runtimePolicy.js";\n  import { trustedIconNodes } from "./trustedIconNodes.js";\n  import { getVadivamContext } from "${shared}context.js";\n  import type { VadivamProps } from "./types.js";\n  const context = getVadivamContext();\n  let { name, color, size, strokeWidth, absoluteStrokeWidth, title, iconNode = [], children, class: className = "", ...rest }: VadivamProps = $props();\n  const resolvedSize = $derived(size ?? context.size ?? ${defaultSize});\n  const mergedClass = $derived(mergeClasses("vadivam", name && \`vadivam-\${name}\`, context.class, className));\n  const safeRest = $derived(sanitizeRootAttributes(rest, true));\n  const safeIconNode = $derived(trustedIconNodes.has(iconNode) ? iconNode : sanitizeIconNode(iconNode));\n  const labelled = $derived(isLabelled(title, Object.keys(safeRest)));\n</script>\n\n<svg {...defaultAttributes} {...safeRest} width={resolvedSize} height={resolvedSize} ${paint} class={mergedClass} {...(!labelled ? { "aria-hidden": "true" } : {})} {...(title ? { role: "img" } : {})}>\n  {#if title}<title>{title}</title>{/if}\n  {#each safeIconNode as [tag, attrs]}<svelte:element this={tag} {...attrs} />{/each}\n  {@render children?.()}\n</svg>\n`);
  await write(dist, "Icon.svelte.d.ts", `import type { Component } from "svelte";\nimport type { VadivamProps } from "./types.js";\ndeclare const Icon: Component<VadivamProps>;\nexport default Icon;\n`);
  await write(dist, "createVadivamIcon.js", `export function createVadivamIcon(name, iconNode) { return Object.freeze({ name, iconNode }); }\nexport default createVadivamIcon;\n`);
  await write(dist, "createVadivamIcon.d.ts", `import type { IconDefinition, IconNode } from "./types.js";\nexport declare function createVadivamIcon(name: string, iconNode: IconNode): IconDefinition;\nexport default createVadivamIcon;\n`);
  for (const icon of icons) {
    const source = `<script module lang="ts">\n  import type { IconNode } from "../types.js";\n  import { trustedIconNodes } from "../trustedIconNodes.js";\n  export const __iconNode: IconNode = ${iconNode(icon)};\n  trustedIconNodes.add(__iconNode);\n</script>\n<script lang="ts">\n  import Icon from "../Icon.svelte";\n  import type { VadivamProps } from "../types.js";\n  let props: VadivamProps = $props();\n</script>\n<Icon name="${icon.name}" iconNode={__iconNode} {...props} />\n`;
    await writeSvelte(dist, `icons/${icon.name}.svelte`, source);
    await write(dist, `icons/${icon.name}.js`, `export { default, __iconNode } from "./${icon.name}.svelte";\n`);
    await write(dist, `icons/${icon.name}.svelte.d.ts`, `import type { Component } from "svelte";\nimport type { IconNode, VadivamProps } from "../types.js";\nexport declare const __iconNode: IconNode;\ndeclare const icon: Component<VadivamProps>;\nexport default icon;\n`);
    await write(dist, `icons/${icon.name}.d.ts`, `export { default, __iconNode } from "./${icon.name}.svelte";\n`);
  }
  await write(dist, "icons.js", `${iconImports(icons)}\nexport const icons = {\n${iconRegistryEntries(icons)}\n};\nexport default icons;\n`);
  await write(dist, "icons.d.ts", `import type { VadivamIcon } from "./types.js";\nexport declare const icons: {\n${iconRegistryTypes(icons, "VadivamIcon")}\n};\nexport default icons;\n`);
  await write(dist, "icons/index.js", `${iconExports(icons, { prefix: "./" })}\n`);
  await write(dist, "icons/index.d.ts", `${iconExports(icons, { prefix: "./" })}\n`);
  await write(dist, "dynamicIconImports.js", `const dynamicIconImports = {\n${dynamicEntries(icons)}\n};\nexport const iconNames = Object.keys(dynamicIconImports);\nexport { dynamicIconImports };\nexport default dynamicIconImports;\n`);
  await write(dist, "dynamicIconImports.d.ts", `import type { IconNode, VadivamIcon } from "./types.js";\nexport interface DynamicIconModule { default: VadivamIcon; __iconNode: IconNode; }\ndeclare const dynamicIconImports: {\n${dynamicTypes(icons)}\n};\nexport declare const iconNames: readonly (keyof typeof dynamicIconImports)[];\nexport { dynamicIconImports };\nexport default dynamicIconImports;\n`);
  await writeSvelte(dist, "DynamicIcon.svelte", `<script lang="ts">\n  import dynamicIconImports from "./dynamicIconImports.js";\n  import type { Component, Snippet } from "svelte";\n  import type { IconName, VadivamProps } from "./types.js";\n  let { name, fallback, ...props }: { name: IconName; fallback?: Snippet } & VadivamProps = $props();\n  let Loaded: Component<VadivamProps> | undefined = $state();\n  let request = 0;\n  $effect(() => { const id = ++request; Loaded = undefined; const importer = Object.prototype.hasOwnProperty.call(dynamicIconImports, name) ? dynamicIconImports[name] : undefined; if (importer) importer().then((module) => { if (request === id) Loaded = module.default; }, () => { if (request === id) Loaded = undefined; }); return () => { request += 1; }; });\n</script>\n{#if Loaded}<Loaded {...props} />{:else}{@render fallback?.()}{/if}\n`);
  await write(dist, "DynamicIcon.svelte.d.ts", `import type { Component, Snippet } from "svelte";\nimport type { IconName, VadivamProps } from "./types.js";\ndeclare const DynamicIcon: Component<VadivamProps & { name: IconName; fallback?: Snippet }>;\nexport default DynamicIcon;\n`);
  await writeExports(dist, "index", indexExports(icons, shared));
}
