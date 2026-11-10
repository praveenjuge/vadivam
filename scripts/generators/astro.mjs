import path from "node:path";
import {
  buildStyles,
  defaultAttributesSource,
  defaultSize,
  defaultStrokeWidth,
  dynamicEntries,
  dynamicTypes,
  exportedNames,
  iconExports,
  iconImports,
  iconNameType,
  iconNode,
  iconRegistryEntries,
  iconRegistryTypes,
  isLabelledSource,
  mergeClassesSource,
  objectEntries,
  paintBindings,
  prepareDist,
  scaledStrokeWidthSource,
  svgElementTypeSource,
  write,
  writeExports,
  writeRuntimePolicy,
  writeTrustedIconNodes,
} from "./shared.mjs";

const location = { extension: "astro" };

const indexExports = (icons) => [
  { icons, location },
  { from: "./Icon.astro", values: ["default as Icon"] },
  { from: "./createVadivamIcon.js", values: ["createVadivamIcon"] },
  { from: "./icons.js", values: ["icons"] },
  { from: "./dynamicIconImports.js", values: ["dynamicIconImports", "iconNames"] },
  { from: "./types.js", types: ["IconDefinition", "IconName", "IconNode", "SVGElementType", "VadivamIcon", "VadivamProps"] },
];

/** Every name the root entry exports besides the icons; DynamicIcon is its own .astro module. */
export const apiExports = exportedNames(indexExports([]));

export async function build({ iconsByStyle, directory }) {
  const dist = path.join(directory, "dist");
  await prepareDist(dist);
  await writeRuntimePolicy(dist);
  await buildStyles(dist, iconsByStyle, buildAstroEntry);
}

async function buildAstroEntry(dist, icons, style) {
  const shared = style.shared;
  const paint = objectEntries(paintBindings(style, {
    color: "sanitizePaint(color)",
    strokeWidth: `strokeWidth ?? kebabStrokeWidth ?? ${defaultStrokeWidth}`,
    size: "size",
    absolute: "absoluteStrokeWidth",
  }));
  const helpers = [mergeClassesSource, isLabelledSource, ...(style.stroked ? [scaledStrokeWidthSource] : [])].map((source) => `${source({ typeScript: true })}\n`).join("");
  // Each style entry trusts the nodes generated with it.
  await writeTrustedIconNodes(dist);
  await write(dist, "types.d.ts", `import type { HTMLAttributes } from "astro/types";\nexport type SVGElementType = ${svgElementTypeSource};\nexport type IconNode = readonly [tag: SVGElementType, attrs: Record<string, string | number | boolean>][];\nexport interface VadivamProps extends ${style.stroked ? 'HTMLAttributes<"svg">' : 'Omit<HTMLAttributes<"svg">, "stroke-width">'} { name?: string; size?: string | number; color?: string;${style.stroked ? ' strokeWidth?: string | number; "stroke-width"?: string | number; absoluteStrokeWidth?: boolean;' : ""} title?: string; iconNode?: IconNode; }\nexport interface IconDefinition { name: string; iconNode: IconNode; }\nexport type VadivamIcon = (_props: VadivamProps) => unknown;\nexport type IconName = ${iconNameType(icons)};\n`);
  await write(dist, "defaultAttributes.js", `export default ${defaultAttributesSource(style)};\n`);
  await write(dist, "createVadivamIcon.js", `export function createVadivamIcon(name, iconNode) { return Object.freeze({ name, iconNode }); }\nexport default createVadivamIcon;\n`);
  await write(dist, "createVadivamIcon.d.ts", `import type { IconDefinition, IconNode } from "./types.js";\nexport declare function createVadivamIcon(name: string, iconNode: IconNode): IconDefinition;\nexport default createVadivamIcon;\n`);
  await write(dist, "Icon.astro", `---\nimport defaultAttributes from "./defaultAttributes.js";\nimport { sanitizeIconNode, sanitizePaint, sanitizeRootAttributes } from "${shared}runtimePolicy.js";\nimport { trustedIconNodes } from "./trustedIconNodes.js";\nimport type { VadivamProps } from "./types.js";\nconst { name, size = ${defaultSize}, color = "currentColor", strokeWidth, "stroke-width": kebabStrokeWidth, absoluteStrokeWidth = false, title, iconNode = [], class: className, ...rest } = Astro.props as VadivamProps${style.stroked ? "" : ' & { strokeWidth?: unknown; "stroke-width"?: unknown; absoluteStrokeWidth?: unknown }'};\n${helpers}const safeRest = sanitizeRootAttributes(rest);\nconst safeIconNode = trustedIconNodes.has(iconNode) ? iconNode : sanitizeIconNode(iconNode);\nconst labelled = isLabelled(title, Object.keys(safeRest));\nconst mergedClass = mergeClasses("vadivam", name && \`vadivam-\${name}\`, className);\nconst svgAttributes = { ...defaultAttributes, width: size, height: size, ${paint}, class: mergedClass, ...(!labelled ? { "aria-hidden": "true" } : {}), ...(title ? { role: "img" } : {}), ...safeRest };\n---\n<svg {...svgAttributes}>\n  {title && <title>{title}</title>}\n  {safeIconNode.map(([Tag, attrs]) => <Tag {...attrs} />)}\n  <slot />\n</svg>\n`);
  await write(dist, "Icon.astro.d.ts", `import type { AstroComponentFactory } from "astro/runtime/server/index.js";\ndeclare const Icon: AstroComponentFactory;\nexport default Icon;\n`);
  for (const icon of icons) {
    await write(dist, `icons/${icon.name}.astro`, `---\nimport Icon from "../Icon.astro";\nimport { trustedIconNodes } from "../trustedIconNodes.js";\nimport type { IconNode, VadivamProps } from "../types.js";\nexport const __iconNode: IconNode = ${iconNode(icon)};\ntrustedIconNodes.add(__iconNode);\nconst props = Astro.props as VadivamProps;\n---\n<Icon name="${icon.name}" iconNode={__iconNode} {...props}><slot /></Icon>\n`);
    await write(dist, `icons/${icon.name}.astro.d.ts`, `import type { AstroComponentFactory } from "astro/runtime/server/index.js";\nimport type { IconNode } from "../types.js";\nexport declare const __iconNode: IconNode;\ndeclare const icon: AstroComponentFactory;\nexport default icon;\n`);
  }
  await write(dist, "icons.js", `${iconImports(icons, location)}\nexport const icons = {\n${iconRegistryEntries(icons)}\n};\nexport default icons;\n`);
  await write(dist, "icons.d.ts", `import type { VadivamIcon } from "./types.js";\nexport declare const icons: {\n${iconRegistryTypes(icons, "VadivamIcon")}\n};\nexport default icons;\n`);
  await write(dist, "icons/index.js", `${iconExports(icons, { ...location, prefix: "./" })}\n`);
  await write(dist, "icons/index.d.ts", `${iconExports(icons, { ...location, prefix: "./" })}\n`);
  await write(dist, "dynamicIconImports.js", `const dynamicIconImports = {\n${dynamicEntries(icons, location)}\n};\nexport const iconNames = Object.keys(dynamicIconImports);\nexport { dynamicIconImports };\nexport default dynamicIconImports;\n`);
  await write(dist, "dynamicIconImports.d.ts", `import type { IconNode, VadivamIcon } from "./types.js";\nexport interface DynamicIconModule { default: VadivamIcon; __iconNode: IconNode; }\ndeclare const dynamicIconImports: {\n${dynamicTypes(icons)}\n};\nexport declare const iconNames: readonly (keyof typeof dynamicIconImports)[];\nexport { dynamicIconImports };\nexport default dynamicIconImports;\n`);
  await write(dist, "DynamicIcon.astro", `---\nimport dynamicIconImports from "./dynamicIconImports.js";\nimport type { IconName, VadivamProps } from "./types.js";\nconst { name, ...props } = Astro.props as VadivamProps & { name: IconName };\nconst importer = Object.prototype.hasOwnProperty.call(dynamicIconImports, name) ? dynamicIconImports[name] : undefined;\nconst Loaded = importer ? (await importer()).default : null;\n---\n{Loaded ? <Loaded {...props}><slot /></Loaded> : <slot name="fallback" />}\n`);
  await write(dist, "DynamicIcon.astro.d.ts", `import type { AstroComponentFactory } from "astro/runtime/server/index.js";\ndeclare const DynamicIcon: AstroComponentFactory;\nexport default DynamicIcon;\n`);
  await writeExports(dist, "index", indexExports(icons));
}
