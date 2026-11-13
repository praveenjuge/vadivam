import path from "node:path";
import {
  buildStyles,
  defaultAttributesSource,
  dynamicDeclarations,
  dynamicEntries,
  dynamicExports,
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
  objectEntries,
  paintBindings,
  prepareDist,
  scaledStrokeWidthSource,
  strokePropTypes,
  svgElementTypeSource,
  write,
  writeExports,
  writeRuntimePolicy,
} from "./shared.mjs";

const indexExports = (icons, shared) => [
  { icons },
  { from: "./Icon.js", values: ["Icon"] },
  { from: "./createVadivamIcon.js", values: ["createVadivamIcon"] },
  { from: "./icons.js", values: ["icons"] },
  { from: `${shared}context.js`, values: ["VADIVAM_CONTEXT", "VadivamProvider", "provideVadivam", "useVadivamContext"] },
  { from: "./dynamicIconImports.js", values: ["dynamicIconImports", "iconNames"] },
  { from: "./types.js", types: ["IconName", "IconNode", "SVGElementType", "VadivamIcon", "VadivamProps"] },
];

/** Every name the root and dynamic entries export besides the icons. */
export const apiExports = [...exportedNames(indexExports([], "./")), ...dynamicExports];

export async function build({ iconsByStyle, directory }) {
  const dist = path.join(directory, "dist");
  await prepareDist(dist);
  await writeRuntimePolicy(dist);
  await write(dist, "context.js", `import { defineComponent, h, inject, provide } from "vue";\nexport const VADIVAM_CONTEXT = Symbol("vadivam-icons");\nexport function provideVadivam(props) { provide(VADIVAM_CONTEXT, props); return props; }\nexport function useVadivamContext() { return inject(VADIVAM_CONTEXT, {}); }\nexport const VadivamProvider = defineComponent({ name: "VadivamProvider", inheritAttrs: false, props: { size: [String, Number], color: String, strokeWidth: [String, Number], absoluteStrokeWidth: Boolean, class: String }, setup(props, { slots }) { provideVadivam(props); return () => slots.default?.() ?? null; } });\n`);
  await write(dist, "context.d.ts", `import type { DefineComponent } from "vue";\nimport type { VadivamProps } from "./types.js";\nexport declare const VADIVAM_CONTEXT: unique symbol;\nexport declare function provideVadivam(props: Partial<VadivamProps>): Partial<VadivamProps>;\nexport declare function useVadivamContext(): Partial<VadivamProps>;\nexport declare const VadivamProvider: DefineComponent<Pick<VadivamProps, "size" | "color" | "strokeWidth" | "absoluteStrokeWidth" | "class">>;\n`);
  await buildStyles(dist, iconsByStyle, buildVueEntry);
}

async function buildVueEntry(dist, icons, style) {
  const shared = style.shared;
  const paint = objectEntries(paintBindings(style, {
    color: "sanitizePaint(props.color ?? context.color)",
    strokeWidth: `props.strokeWidth ?? context.strokeWidth ?? ${defaultStrokeWidth}`,
    size: "size",
    absolute: "props.absoluteStrokeWidth ?? context.absoluteStrokeWidth ?? false",
  }));
  await write(dist, "types.d.ts", `import type { FunctionalComponent, SVGAttributes } from "vue";\nexport type SVGElementType = ${svgElementTypeSource};\nexport type IconNode = readonly [tag: SVGElementType, attrs: Record<string, string | number | boolean>][];\nexport interface VadivamProps extends Partial<${style.stroked ? "SVGAttributes" : 'Omit<SVGAttributes, "stroke-width">'}> { name?: string; size?: string | number; color?: string;${strokePropTypes(style)} title?: string; iconNode?: IconNode; }\nexport type VadivamIcon = FunctionalComponent<VadivamProps>;\nexport type IconName = ${iconNameType(icons)};\n`);
  await write(dist, "defaultAttributes.js", `export default ${defaultAttributesSource(style)};\n`);
  await write(dist, "IconBase.js", `import { h } from "vue";\nimport defaultAttributes from "./defaultAttributes.js";\nimport { sanitizePaint, sanitizeRootAttributes } from "${shared}runtimePolicy.js";\nimport { useVadivamContext } from "${shared}context.js";\n${mergeClassesSource()}\n${isLabelledSource()}\n${style.stroked ? `${scaledStrokeWidthSource()}\n` : ""}// Renders nodes as given: built-in icons pass nodes checked when the package is\n// built, and Icon passes caller nodes after sanitizing them.\nexport function IconBase(props, { attrs, slots }) { const context = useVadivamContext(); const size = props.size ?? context.size ?? ${defaultSize}; const safeAttrs = sanitizeRootAttributes(attrs, true); const labelled = isLabelled(props.title, Object.keys(safeAttrs)); return h("svg", { ...defaultAttributes, ...safeAttrs, width: size, height: size, ${paint}, class: mergeClasses("vadivam", props.name && "vadivam-" + props.name, context.class, safeAttrs.class), ...(!labelled ? { "aria-hidden": "true" } : {}), ...(props.title ? { role: "img" } : {}) }, [props.title ? h("title", props.title) : null, ...(props.iconNode ?? []).map(([tag, nodeAttrs]) => h(tag, nodeAttrs)), ...(slots.default?.() ?? [])]); }\nIconBase.props = { name: null, iconNode: null, size: null, color: null, strokeWidth: null, absoluteStrokeWidth: { type: Boolean, default: undefined }, title: null };\nIconBase.inheritAttrs = false;\n`);
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
  await write(dist, "icons/index.js", `${iconExports(icons, { prefix: "./" })}\n`);
  await write(dist, "icons/index.d.ts", `${iconExports(icons, { prefix: "./" })}\n`);
  await write(dist, "dynamicIconImports.js", `const dynamicIconImports = {\n${dynamicEntries(icons)}\n};\nexport const iconNames = Object.keys(dynamicIconImports);\nexport { dynamicIconImports };\nexport default dynamicIconImports;\n`);
  await write(dist, "dynamicIconImports.d.ts", `import type { IconNode, VadivamIcon } from "./types.js";\nexport interface DynamicIconModule { default: VadivamIcon; __iconNode: IconNode; }\ndeclare const dynamicIconImports: {\n${dynamicTypes(icons)}\n};\nexport declare const iconNames: readonly (keyof typeof dynamicIconImports)[];\nexport { dynamicIconImports };\nexport default dynamicIconImports;\n`);
  // One async component per name, so a prop change re-renders the loaded icon instead of remounting it.
  await write(dist, "dynamic.js", `import { computed, defineAsyncComponent, defineComponent, h } from "vue";\nimport dynamicIconImports, { iconNames } from "./dynamicIconImports.js";\nexport const DynamicIcon = defineComponent({ name: "DynamicIcon", inheritAttrs: false, props: { name: { type: String, required: true }, fallback: null }, setup(props, { attrs, slots }) { const AsyncIcon = computed(() => { const importer = Object.prototype.hasOwnProperty.call(dynamicIconImports, props.name) ? dynamicIconImports[props.name] : undefined; return importer ? defineAsyncComponent({ loader: importer, loadingComponent: slots.fallback ? { setup: () => () => slots.fallback?.() } : undefined }) : null; }); return () => AsyncIcon.value ? h(AsyncIcon.value, attrs, slots) : slots.fallback?.() ?? props.fallback ?? null; } });\nexport { dynamicIconImports, iconNames };\nexport default DynamicIcon;\n`);
  await write(dist, "dynamic.d.ts", dynamicDeclarations({ imports: `import type { DefineComponent } from "vue";\n`, fallback: "unknown", declaration: `export declare const DynamicIcon: DefineComponent<DynamicIconProps>;` }));
  await writeExports(dist, "index", indexExports(icons, shared));
}
