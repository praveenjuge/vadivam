import {
  dynamicTypes,
  iconNameType,
  iconNode,
  prepareDist,
  write,
} from "./shared.mjs";

function exportsFor(icons, prefix = "./icons/") {
  return icons
    .map(
      ({ componentName, name }) =>
        `export { default as ${componentName}, default as ${componentName}Icon, default as Vadivam${componentName} } from "${prefix}${name}.astro";`,
    )
    .join("\n");
}

export async function buildAstroPackage(icons, dist) {
  await prepareDist(dist);
  await write(dist, "types.d.ts", `import type { HTMLAttributes } from "astro/types";\nexport type SVGElementType = "circle" | "ellipse" | "line" | "path" | "polygon" | "polyline" | "rect";\nexport type IconNode = readonly [tag: SVGElementType, attrs: Record<string, string>][];\nexport interface VadivamProps extends HTMLAttributes<"svg"> { name?: string; size?: string | number; color?: string; strokeWidth?: string | number; "stroke-width"?: string | number; absoluteStrokeWidth?: boolean; title?: string; iconNode?: IconNode; }\nexport interface IconDefinition { name: string; iconNode: IconNode; }\nexport type VadivamIcon = (_props: VadivamProps) => unknown;\nexport type IconName = ${iconNameType(icons)};\n`);
  await write(dist, "defaultAttributes.js", `export default { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" };\n`);
  await write(dist, "createVadivamIcon.js", `export function createVadivamIcon(name, iconNode) { return Object.freeze({ name, iconNode }); }\nexport default createVadivamIcon;\n`);
  await write(dist, "createVadivamIcon.d.ts", `import type { IconDefinition, IconNode } from "./types.js";\nexport declare function createVadivamIcon(name: string, iconNode: IconNode): IconDefinition;\nexport default createVadivamIcon;\n`);
  await write(dist, "Icon.astro", `---\nimport defaultAttributes from "./defaultAttributes.js";\nimport type { VadivamProps } from "./types.js";\nconst { name, size = 24, color = "currentColor", strokeWidth, "stroke-width": kebabStrokeWidth, absoluteStrokeWidth = false, title, iconNode = [], class: className, ...rest } = Astro.props as VadivamProps;\nconst resolvedStroke = strokeWidth ?? kebabStrokeWidth ?? 2;\nconst numericSize = Number(size);\nconst numericStroke = Number(resolvedStroke);\nconst calculatedStroke = absoluteStrokeWidth && Number.isFinite(numericSize) && numericSize !== 0 && Number.isFinite(numericStroke) ? numericStroke * 24 / numericSize : resolvedStroke;\nconst labelled = Boolean(title) || Object.keys(rest).some((key) => key.startsWith("aria-") || key === "role");\nconst mergedClass = Array.from(new Set(["vadivam", name && \`vadivam-\${name}\`, className].flatMap((value) => typeof value === "string" ? value.split(/\\s+/) : []).filter(Boolean))).join(" ");\nconst svgAttributes = { ...defaultAttributes, width: size, height: size, stroke: color, "stroke-width": calculatedStroke, class: mergedClass, ...(!labelled ? { "aria-hidden": "true" } : {}), ...(title ? { role: "img" } : {}), ...rest };\n---\n<svg {...svgAttributes}>\n  {title && <title>{title}</title>}\n  {iconNode.map(([Tag, attrs]) => <Tag {...attrs} />)}\n  <slot />\n</svg>\n`);
  await write(dist, "Icon.astro.d.ts", `import type { AstroComponentFactory } from "astro/runtime/server/index.js";\ndeclare const Icon: AstroComponentFactory;\nexport default Icon;\n`);
  for (const icon of icons) {
    await write(dist, `icons/${icon.name}.astro`, `---\nimport Icon from "../Icon.astro";\nimport type { IconNode, VadivamProps } from "../types.js";\nexport const __iconNode: IconNode = ${iconNode(icon)};\nconst props = Astro.props as VadivamProps;\n---\n<Icon name="${icon.name}" iconNode={__iconNode} {...props}><slot /></Icon>\n`);
    await write(dist, `icons/${icon.name}.astro.d.ts`, `import type { AstroComponentFactory } from "astro/runtime/server/index.js";\nimport type { IconNode } from "../types.js";\nexport declare const __iconNode: IconNode;\ndeclare const icon: AstroComponentFactory;\nexport default icon;\n`);
  }
  const imports = icons
    .map(
      ({ componentName, name }) =>
        `import ${componentName} from "./icons/${name}.astro";`,
    )
    .join("\n");
  const registry = icons.map(({ componentName }) => `  ${componentName}`).join(",\n");
  await write(dist, "icons.js", `${imports}\nexport const icons = {\n${registry}\n};\nexport default icons;\n`);
  await write(dist, "icons.d.ts", `import type { VadivamIcon } from "./types.js";\nexport declare const icons: Record<string, VadivamIcon>;\nexport default icons;\n`);
  await write(dist, "icons/index.js", `${exportsFor(icons, "./")}\n`);
  await write(dist, "icons/index.d.ts", `${exportsFor(icons, "./")}\n`);
  await write(dist, "dynamicIconImports.js", `const dynamicIconImports = {\n${icons.map(({ name }) => `  ${JSON.stringify(name)}: () => import("./icons/${name}.astro")`).join(",\n")}\n};\nexport const iconNames = Object.keys(dynamicIconImports);\nexport { dynamicIconImports };\nexport default dynamicIconImports;\n`);
  await write(dist, "dynamicIconImports.d.ts", `import type { IconNode, VadivamIcon } from "./types.js";\nexport interface DynamicIconModule { default: VadivamIcon; __iconNode: IconNode; }\ndeclare const dynamicIconImports: {\n${dynamicTypes(icons)}\n};\nexport declare const iconNames: readonly (keyof typeof dynamicIconImports)[];\nexport { dynamicIconImports };\nexport default dynamicIconImports;\n`);
  await write(dist, "DynamicIcon.astro", `---\nimport dynamicIconImports from "./dynamicIconImports.js";\nimport type { IconName, VadivamProps } from "./types.js";\nconst { name, ...props } = Astro.props as VadivamProps & { name: IconName };\nconst importer = dynamicIconImports[name];\nconst Loaded = importer ? (await importer()).default : null;\n---\n{Loaded ? <Loaded {...props}><slot /></Loaded> : <slot name="fallback" />}\n`);
  await write(dist, "DynamicIcon.astro.d.ts", `import type { AstroComponentFactory } from "astro/runtime/server/index.js";\ndeclare const DynamicIcon: AstroComponentFactory;\nexport default DynamicIcon;\n`);
  const exports = exportsFor(icons);
  await write(dist, "index.js", `${exports}\nexport { default as Icon } from "./Icon.astro";\nexport { createVadivamIcon } from "./createVadivamIcon.js";\nexport { icons } from "./icons.js";\nexport { dynamicIconImports, iconNames } from "./dynamicIconImports.js";\n`);
  await write(dist, "index.d.ts", `${exports}\nexport { default as Icon } from "./Icon.astro";\nexport { createVadivamIcon } from "./createVadivamIcon.js";\nexport { icons } from "./icons.js";\nexport { dynamicIconImports, iconNames } from "./dynamicIconImports.js";\nexport type { IconDefinition, IconName, IconNode, SVGElementType, VadivamIcon, VadivamProps } from "./types.js";\n`);
}
