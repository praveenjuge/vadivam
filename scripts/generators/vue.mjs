import {
  buildStyles,
  defaultAttributesSource,
  dynamicEntries,
  dynamicTypes,
  iconExports,
  iconImports,
  iconNameType,
  iconNode,
  iconRegistryEntries,
  iconRegistryTypes,
  prepareDist,
  strokePropTypes,
  svgElementTypeSource,
  write,
  writeRuntimePolicy,
} from "./shared.mjs";

export async function buildVuePackage(icons, dist, solidIcons = []) {
  await prepareDist(dist);
  await writeRuntimePolicy(dist);
  await write(dist, "context.js", `import { defineComponent, h, inject, provide } from "vue";\nexport const VADIVAM_CONTEXT = Symbol("vadivam-icons");\nexport function provideVadivam(props) { provide(VADIVAM_CONTEXT, props); return props; }\nexport function useVadivamContext() { return inject(VADIVAM_CONTEXT, {}); }\nexport const VadivamProvider = defineComponent({ name: "VadivamProvider", inheritAttrs: false, props: { size: [String, Number], color: String, strokeWidth: [String, Number], absoluteStrokeWidth: Boolean, class: String }, setup(props, { slots }) { provideVadivam(props); return () => slots.default?.() ?? null; } });\n`);
  await write(dist, "context.d.ts", `import type { DefineComponent } from "vue";\nimport type { VadivamProps } from "./types.js";\nexport declare const VADIVAM_CONTEXT: unique symbol;\nexport declare function provideVadivam(props: Partial<VadivamProps>): Partial<VadivamProps>;\nexport declare function useVadivamContext(): Partial<VadivamProps>;\nexport declare const VadivamProvider: DefineComponent<Pick<VadivamProps, "size" | "color" | "strokeWidth" | "absoluteStrokeWidth" | "class">>;\n`);
  await buildStyles(dist, { outline: icons, solid: solidIcons }, buildVueEntry);
}

// An outline icon paints its stroke and scales its width; a solid icon paints
// its fill and has no stroke to scale.
function paintSource(style) {
  if (!style.stroked) return { resolve: "", attributes: `fill: sanitizePaint(props.color ?? context.color)` };
  return {
    resolve: `const strokeWidth = props.strokeWidth ?? context.strokeWidth ?? 2; const numericSize = Number(size); const numericStroke = Number(strokeWidth); const absolute = props.absoluteStrokeWidth ?? context.absoluteStrokeWidth ?? false; const calculated = absolute && Number.isFinite(numericSize) && numericSize !== 0 && Number.isFinite(numericStroke) ? numericStroke * 24 / numericSize : strokeWidth; `,
    attributes: `stroke: sanitizePaint(props.color ?? context.color), "stroke-width": calculated`,
  };
}

async function buildVueEntry(dist, icons, style) {
  const shared = style.shared;
  const paint = paintSource(style);
  await write(dist, "types.d.ts", `import type { FunctionalComponent, SVGAttributes } from "vue";\nexport type SVGElementType = ${svgElementTypeSource};\nexport type IconNode = readonly [tag: SVGElementType, attrs: Record<string, string | number | boolean>][];\nexport interface VadivamProps extends Partial<${style.stroked ? "SVGAttributes" : 'Omit<SVGAttributes, "stroke-width">'}> { name?: string; size?: string | number; color?: string;${strokePropTypes(style)} title?: string; iconNode?: IconNode; }\nexport type VadivamIcon = FunctionalComponent<VadivamProps>;\nexport type IconName = ${iconNameType(icons)};\n`);
  await write(dist, "defaultAttributes.js", `export default ${defaultAttributesSource(style)};\n`);
  await write(dist, "IconBase.js", `import { h } from "vue";\nimport defaultAttributes from "./defaultAttributes.js";\nimport { sanitizePaint, sanitizeRootAttributes } from "${shared}runtimePolicy.js";\nimport { useVadivamContext } from "${shared}context.js";\nfunction classes(...values) { return values.flatMap((value) => typeof value === "string" ? value.split(/\\s+/) : []).filter((value, index, all) => value && all.indexOf(value) === index).join(" "); }\nfunction hasA11y(attrs) { return Object.keys(attrs).some((name) => name.startsWith("aria-") || name === "role" || name === "title"); }\n// Renders nodes as given: built-in icons pass nodes checked when the package is\n// built, and Icon passes caller nodes after sanitizing them.\nexport function IconBase(props, { attrs, slots }) { const context = useVadivamContext(); const size = props.size ?? context.size ?? 24; ${paint.resolve}const safeAttrs = sanitizeRootAttributes(attrs, true); const labelled = Boolean(props.title) || hasA11y(safeAttrs); return h("svg", { ...defaultAttributes, ...safeAttrs, width: size, height: size, ${paint.attributes}, class: classes("vadivam", props.name && "vadivam-" + props.name, context.class, safeAttrs.class), ...(!labelled ? { "aria-hidden": "true" } : {}), ...(props.title ? { role: "img" } : {}) }, [props.title ? h("title", props.title) : null, ...(props.iconNode ?? []).map(([tag, nodeAttrs]) => h(tag, nodeAttrs)), ...(slots.default?.() ?? [])]); }\nIconBase.props = ["name", "iconNode", "size", "color", "strokeWidth", "absoluteStrokeWidth", "title"];\nIconBase.inheritAttrs = false;\n`);
  await write(dist, "Icon.js", `import { IconBase } from "./IconBase.js";\nimport { sanitizeIconNode } from "${shared}runtimePolicy.js";\nexport function Icon(props, context) { return IconBase({ ...props, iconNode: sanitizeIconNode(props.iconNode ?? []) }, context); }\nIcon.props = IconBase.props;\nIcon.inheritAttrs = false;\nIcon.displayName = "Icon";\nexport default Icon;\n`);
  await write(dist, "Icon.d.ts", `import type { VadivamIcon } from "./types.js";\nexport declare const Icon: VadivamIcon;\nexport default Icon;\n`);
  await write(dist, "defineIcon.js", `import { h } from "vue";\nimport { IconBase } from "./IconBase.js";\nexport function wrapIcon(Base, iconName, iconNode) { const Component = (props, context) => h(Base, { ...context.attrs, ...props, name: iconName, iconNode }, context.slots); Component.props = Base.props; Component.inheritAttrs = false; Component.displayName = iconName.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join(""); return Component; }\nexport function defineIcon(iconName, iconNode) { return wrapIcon(IconBase, iconName, iconNode); }\n`);
  await write(dist, "createVadivamIcon.js", `import Icon from "./Icon.js";\nimport { wrapIcon } from "./defineIcon.js";\nexport function createVadivamIcon(iconName, iconNode) { return wrapIcon(Icon, iconName, iconNode); }\nexport default createVadivamIcon;\n`);
  await write(dist, "createVadivamIcon.d.ts", `import type { IconNode, VadivamIcon } from "./types.js";\nexport declare function createVadivamIcon(iconName: string, iconNode: IconNode): VadivamIcon;\nexport default createVadivamIcon;\n`);
  for (const icon of icons) {
    await write(dist, `icons/${icon.name}.js`, `import { defineIcon } from "../defineIcon.js";\nexport const __iconNode = ${iconNode(icon)};\nexport default /* @__PURE__ */ defineIcon("${icon.name}", __iconNode);\n`);
    await write(dist, `icons/${icon.name}.d.ts`, `import type { IconNode, VadivamIcon } from "../types.js";\nexport declare const __iconNode: IconNode;\ndeclare const icon: VadivamIcon;\nexport default icon;\n`);
  }
  await write(dist, "icons.js", `${iconImports(icons)}\nexport const icons = {\n${iconRegistryEntries(icons)}\n};\nexport default icons;\n`);
  await write(dist, "icons.d.ts", `import type { VadivamIcon } from "./types.js";\nexport declare const icons: {\n${iconRegistryTypes(icons, "VadivamIcon")}\n};\nexport default icons;\n`);
  await write(dist, "icons/index.js", `${iconExports(icons, "./")}\n`);
  await write(dist, "icons/index.d.ts", `${iconExports(icons, "./")}\n`);
  await write(dist, "dynamicIconImports.js", `const dynamicIconImports = {\n${dynamicEntries(icons)}\n};\nexport const iconNames = Object.keys(dynamicIconImports);\nexport { dynamicIconImports };\nexport default dynamicIconImports;\n`);
  await write(dist, "dynamicIconImports.d.ts", `import type { IconNode, VadivamIcon } from "./types.js";\nexport interface DynamicIconModule { default: VadivamIcon; __iconNode: IconNode; }\ndeclare const dynamicIconImports: {\n${dynamicTypes(icons)}\n};\nexport declare const iconNames: readonly (keyof typeof dynamicIconImports)[];\nexport { dynamicIconImports };\nexport default dynamicIconImports;\n`);
  await write(dist, "dynamic.js", `import { defineAsyncComponent, defineComponent, h } from "vue";\nimport dynamicIconImports, { iconNames } from "./dynamicIconImports.js";\nexport const DynamicIcon = defineComponent({ name: "DynamicIcon", inheritAttrs: false, props: { name: { type: String, required: true }, fallback: null }, setup(props, { attrs, slots }) { return () => { const importer = Object.prototype.hasOwnProperty.call(dynamicIconImports, props.name) ? dynamicIconImports[props.name] : undefined; if (!importer) return slots.fallback?.() ?? props.fallback ?? null; const AsyncIcon = defineAsyncComponent({ loader: importer, loadingComponent: slots.fallback ? { setup: () => slots.fallback } : undefined }); return h(AsyncIcon, attrs, slots); }; } });\nexport { dynamicIconImports, iconNames };\nexport default DynamicIcon;\n`);
  await write(dist, "dynamic.d.ts", `import type { DefineComponent } from "vue";\nimport type { IconName, VadivamProps } from "./types.js";\nexport interface DynamicIconProps extends VadivamProps { name: IconName; fallback?: unknown; }\nexport declare const DynamicIcon: DefineComponent<DynamicIconProps>;\nexport { default as dynamicIconImports, iconNames } from "./dynamicIconImports.js";\nexport default DynamicIcon;\n`);
  const exports = iconExports(icons);
  await write(dist, "index.js", `${exports}\nexport { Icon } from "./Icon.js";\nexport { createVadivamIcon } from "./createVadivamIcon.js";\nexport { icons } from "./icons.js";\nexport { VADIVAM_CONTEXT, VadivamProvider, provideVadivam, useVadivamContext } from "${shared}context.js";\nexport { dynamicIconImports, iconNames } from "./dynamicIconImports.js";\n`);
  await write(dist, "index.d.ts", `${exports}\nexport { Icon } from "./Icon.js";\nexport { createVadivamIcon } from "./createVadivamIcon.js";\nexport { icons } from "./icons.js";\nexport { VADIVAM_CONTEXT, VadivamProvider, provideVadivam, useVadivamContext } from "${shared}context.js";\nexport { dynamicIconImports, iconNames } from "./dynamicIconImports.js";\nexport type { IconName, IconNode, SVGElementType, VadivamIcon, VadivamProps } from "./types.js";\n`);
}
