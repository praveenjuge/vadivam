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
  { from: `${shared}context.js`, values: ["VadivamContext", "VadivamProvider", "useVadivamContext"] },
  { from: "./dynamicIconImports.js", values: ["dynamicIconImports", "iconNames"] },
  { from: "./types.js", types: ["IconName", "IconNode", "SVGElementType", "VadivamIcon", "VadivamProps"] },
  { from: `${shared}context.js`, types: ["VadivamProviderProps"] },
];

/** Every name the root and dynamic entries export besides the icons. */
export const apiExports = [...exportedNames(indexExports([], "./")), ...dynamicExports];

export async function build({ iconsByStyle, directory }) {
  const dist = path.join(directory, "dist");
  await prepareDist(dist);
  await writeRuntimePolicy(dist);
  await write(dist, "context.js", `import { createContext, h } from "preact";\nimport { useContext, useMemo } from "preact/hooks";\nexport const VadivamContext = createContext({});\nexport function VadivamProvider({ children, size, color, strokeWidth, absoluteStrokeWidth, class: className }) { const value = useMemo(() => ({ size, color, strokeWidth, absoluteStrokeWidth, class: className }), [size, color, strokeWidth, absoluteStrokeWidth, className]); return h(VadivamContext.Provider, { value }, children); }\nexport function useVadivamContext() { return useContext(VadivamContext); }\n`);
  await write(dist, "context.d.ts", `import type { ComponentChildren, Context } from "preact";\nimport type { VadivamProps } from "./types.js";\nexport declare const VadivamContext: Context<Partial<VadivamProps>>;\nexport interface VadivamProviderProps extends Pick<VadivamProps, "size" | "color" | "strokeWidth" | "absoluteStrokeWidth" | "class"> { children: ComponentChildren; }\nexport declare function VadivamProvider(props: VadivamProviderProps): import("preact").VNode;\nexport declare function useVadivamContext(): Partial<VadivamProps>;\n`);
  await buildStyles(dist, iconsByStyle, buildPreactEntry);
}

async function buildPreactEntry(dist, icons, style) {
  const shared = style.shared;
  const paint = objectEntries(paintBindings(style, {
    color: "sanitizePaint(color ?? context.color)",
    strokeWidth: `strokeWidth ?? context.strokeWidth ?? ${defaultStrokeWidth}`,
    size: "resolvedSize",
    absolute: "absoluteStrokeWidth ?? context.absoluteStrokeWidth ?? false",
  }));
  await write(dist, "types.d.ts", `import type { ComponentType, JSX } from "preact";\nexport type SVGElementType = ${svgElementTypeSource};\nexport type IconNode = readonly [tag: SVGElementType, attrs: Record<string, string | number | boolean>][];\nexport interface VadivamProps extends Omit<JSX.SVGAttributes<SVGSVGElement>, "color" | "size"${style.stroked ? "" : ' | "strokeWidth" | "stroke-width"'}> { name?: string; size?: string | number; color?: string;${strokePropTypes(style)} title?: string; iconNode?: IconNode; }\nexport type VadivamIcon = ComponentType<VadivamProps>;\nexport type IconName = ${iconNameType(icons)};\n`);
  await write(dist, "defaultAttributes.js", `export default ${defaultAttributesSource(style)};\n`);
  await write(dist, "IconBase.js", `import { h, toChildArray } from "preact";\nimport defaultAttributes from "./defaultAttributes.js";\nimport { sanitizePaint, sanitizeRootAttributes } from "${shared}runtimePolicy.js";\nimport { useVadivamContext } from "${shared}context.js";\n${mergeClassesSource()}\n${isLabelledSource()}\n${style.stroked ? `${scaledStrokeWidthSource()}\n` : ""}// Renders nodes as given: built-in icons pass nodes checked when the package is\n// built, and Icon passes caller nodes after sanitizing them.\nexport function IconBase({ color, size, strokeWidth, absoluteStrokeWidth, children, iconNode = [], name, title, class: className = "", className: reactClass = "", ...rest }) { const context = useVadivamContext() ?? {}; const resolvedSize = size ?? context.size ?? ${defaultSize}; const safeRest = sanitizeRootAttributes(rest, true); const labelled = isLabelled(title, Object.keys(safeRest)); return h("svg", { ...defaultAttributes, width: resolvedSize, height: resolvedSize, ${paint}, class: mergeClasses("vadivam", name && "vadivam-" + name, context.class, className, reactClass), ...(!labelled ? { "aria-hidden": "true" } : {}), ...(title ? { role: "img" } : {}), ...safeRest }, [title ? h("title", null, title) : null, ...iconNode.map(([tag, attrs]) => h(tag, attrs)), ...toChildArray(children)]); }\n`);
  await write(dist, "Icon.js", `import { IconBase } from "./IconBase.js";\nimport { sanitizeIconNode } from "${shared}runtimePolicy.js";\nexport function Icon({ iconNode, ...props }) { return IconBase({ ...props, iconNode: sanitizeIconNode(iconNode) }); }\nexport default Icon;\n`);
  await write(dist, "Icon.d.ts", `import type { VadivamProps } from "./types.js";\nexport declare function Icon(props: VadivamProps): import("preact").VNode;\nexport default Icon;\n`);
  await write(dist, "defineIcon.js", `import { h } from "preact";\nimport { IconBase } from "./IconBase.js";\nexport function wrapIcon(Base, iconName, iconNode) { const Component = ({ children, ...props }) => h(Base, { ...props, name: iconName, iconNode }, children); Component.displayName = iconName.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join(""); return Component; }\nexport function defineIcon(iconName, iconNode) { return wrapIcon(IconBase, iconName, iconNode); }\n`);
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
  await write(dist, "dynamic.js", `import { h } from "preact";\nimport { useEffect, useRef, useState } from "preact/hooks";\nimport dynamicIconImports, { iconNames } from "./dynamicIconImports.js";\nexport function DynamicIcon({ name, fallback = null, ...props }) { const [Component, setComponent] = useState(null); const request = useRef(0); useEffect(() => { const id = ++request.current; setComponent(null); const importer = Object.prototype.hasOwnProperty.call(dynamicIconImports, name) ? dynamicIconImports[name] : undefined; if (importer) importer().then((module) => { if (request.current === id) setComponent(() => module.default); }, () => { if (request.current === id) setComponent(null); }); return () => { request.current += 1; }; }, [name]); return Component ? h(Component, props) : fallback; }\nexport { dynamicIconImports, iconNames };\nexport default DynamicIcon;\n`);
  await write(dist, "dynamic.d.ts", dynamicDeclarations({ imports: `import type { ComponentChildren } from "preact";\n`, fallback: "ComponentChildren", declaration: `export declare function DynamicIcon(props: DynamicIconProps): import("preact").ComponentChildren;` }));
  await writeExports(dist, "index", indexExports(icons, shared));
}
