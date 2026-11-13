import path from "node:path";
import { transformAsync } from "@babel/core";
import solidPreset from "babel-preset-solid";
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
  exportsSource,
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
} from "./shared.mjs";

// Each JSX module is compiled into dist and kept as written under source/,
// which mirrors dist with .jsx modules. Templates take the paths they import
// so both copies resolve: a style entry's source/ under solid/ reaches the
// root's context and runtime policy two folders up.
function modulePaths(style, source) {
  if (!source) return { context: `${style.shared}context.js`, runtimePolicy: `${style.shared}runtimePolicy.js`, local: (name) => `./${name}.js` };
  const nested = style.shared !== "./";
  return {
    context: nested ? "../../source/context.jsx" : "./context.jsx",
    runtimePolicy: nested ? "../../runtimePolicy.js" : "./runtimePolicy.js",
    local: (name) => `./${name}.jsx`,
  };
}

async function writeJsx(dist, relativePath, template, style = { shared: "./" }) {
  await write(dist, `source/${relativePath.replace(/\.js$/, ".jsx")}`, template(modulePaths(style, true)));
  const result = await transformAsync(template(modulePaths(style, false)), {
    filename: relativePath,
    presets: [[solidPreset, { generate: "ssr", hydratable: true }]],
    sourceMaps: false,
  });
  await write(dist, relativePath, `${result.code}\n`);
}

const indexExports = (icons, paths, location) => [
  { icons, location },
  { from: paths.local("Icon"), values: ["Icon"] },
  { from: paths.local("createVadivamIcon"), values: ["createVadivamIcon"] },
  { from: "./icons.js", values: ["icons"] },
  { from: paths.context, values: ["VadivamContext", "VadivamProvider", "useVadivamContext"] },
  { from: "./dynamicIconImports.js", values: ["dynamicIconImports", "iconNames"] },
  { from: "./types.js", types: ["IconName", "IconNode", "SVGElementType", "VadivamIcon", "VadivamProps"] },
  { from: paths.context, types: ["VadivamProviderProps"] },
];

/** Every name the root and dynamic entries export besides the icons. */
export const apiExports = [...exportedNames(indexExports([], modulePaths({ shared: "./" }, false))), ...dynamicExports];

export async function build({ iconsByStyle, directory }) {
  const dist = path.join(directory, "dist");
  await prepareDist(dist);
  await writeRuntimePolicy(dist);
  await write(dist, "source/runtimePolicy.js", `export * from "../runtimePolicy.js";\n`);
  await writeJsx(dist, "context.js", () => `import { createContext, splitProps, useContext } from "solid-js";\nexport const VadivamContext = createContext({});\nexport function VadivamProvider(props) { const [value, rest] = splitProps(props, ["size", "color", "strokeWidth", "absoluteStrokeWidth", "class"]); return <VadivamContext.Provider value={value}>{rest.children}</VadivamContext.Provider>; }\nexport function useVadivamContext() { return useContext(VadivamContext); }\n`);
  await write(dist, "context.d.ts", `import type { JSX } from "solid-js";\nimport type { VadivamProps } from "./types.js";\nexport interface VadivamProviderProps extends Pick<VadivamProps, "size" | "color" | "strokeWidth" | "absoluteStrokeWidth" | "class"> { children: JSX.Element; }\nexport declare function VadivamProvider(props: VadivamProviderProps): JSX.Element;\nexport declare function useVadivamContext(): Partial<VadivamProps>;\n`);
  await buildStyles(dist, iconsByStyle, buildSolidEntry);
}

async function buildSolidEntry(dist, icons, style) {
  const shared = style.shared;
  const paint = paintBindings(style, {
    color: "sanitizePaint(local.color ?? context.color)",
    strokeWidth: `local.strokeWidth ?? context.strokeWidth ?? ${defaultStrokeWidth}`,
    size: "resolvedSize()",
    absolute: "local.absoluteStrokeWidth ?? context.absoluteStrokeWidth ?? false",
  }).map(([name, value]) => `${name}={${value}}`).join(" ");
  const helpers = [mergeClassesSource, isLabelledSource, ...(style.stroked ? [scaledStrokeWidthSource] : [])].map((source) => `${source()}\n`).join("");
  await write(dist, "types.d.ts", `import type { Component, JSX } from "solid-js";\nexport type SVGElementType = ${svgElementTypeSource};\nexport type IconNode = readonly [tag: SVGElementType, attrs: Record<string, string | number | boolean>][];\nexport interface VadivamProps extends ${style.stroked ? "JSX.SvgSVGAttributes<SVGSVGElement>" : 'Omit<JSX.SvgSVGAttributes<SVGSVGElement>, "stroke-width">'} { name?: string; size?: string | number; color?: string;${strokePropTypes(style)} title?: string; iconNode?: IconNode; }\nexport type VadivamIcon = Component<VadivamProps>;\nexport type IconName = ${iconNameType(icons)};\n`);
  await write(dist, "defaultAttributes.js", `export default ${defaultAttributesSource(style)};\n`);
  await write(dist, "source/defaultAttributes.js", `export { default } from "../defaultAttributes.js";\n`);
  await writeJsx(dist, "IconBase.js", (paths) => `import { createMemo, For, splitProps } from "solid-js";\nimport { Dynamic } from "solid-js/web";\nimport defaultAttributes from "./defaultAttributes.js";\nimport { sanitizePaint, sanitizeRootAttributes } from "${paths.runtimePolicy}";\nimport { useVadivamContext } from "${paths.context}";\n${helpers}// Renders nodes as given: built-in icons pass nodes checked when the package is\n// built, and Icon passes caller nodes after sanitizing them. The root\n// attributes are sanitized in a memo, so props that start out undefined still apply.\nexport function IconBase(props) { const [local, rest] = splitProps(props, ["color", "size", "strokeWidth", "absoluteStrokeWidth", "children", "iconNode", "name", "title", "class"]); const context = useVadivamContext(); const resolvedSize = () => local.size ?? context.size ?? ${defaultSize}; const safeRest = createMemo(() => sanitizeRootAttributes(rest, true)); return <svg {...defaultAttributes} width={resolvedSize()} height={resolvedSize()} ${paint} class={mergeClasses("vadivam", local.name && "vadivam-" + local.name, context.class, local.class)} aria-hidden={isLabelled(local.title, Object.keys(safeRest())) ? undefined : "true"} role={local.title ? "img" : safeRest().role} {...safeRest()}>{local.title ? <title>{local.title}</title> : null}<For each={local.iconNode ?? []}>{([tag, attrs]) => <Dynamic component={tag} {...attrs} />}</For>{local.children}</svg>; }\n`, style);
  await writeJsx(dist, "Icon.js", (paths) => `import { mergeProps } from "solid-js";\nimport { IconBase } from "${paths.local("IconBase")}";\nimport { sanitizeIconNode } from "${paths.runtimePolicy}";\nexport function Icon(props) { return IconBase(mergeProps(props, { get iconNode() { return sanitizeIconNode(props.iconNode ?? []); } })); }\nexport default Icon;\n`, style);
  await write(dist, "Icon.d.ts", `import type { JSX } from "solid-js";\nimport type { VadivamProps } from "./types.js";\nexport declare function Icon(props: VadivamProps): JSX.Element;\nexport default Icon;\n`);
  await writeJsx(dist, "defineIcon.js", (paths) => `import { IconBase } from "${paths.local("IconBase")}";\nexport function wrapIcon(Base, iconName, iconNode) { const Component = (props) => <Base {...props} name={iconName} iconNode={iconNode} />; return Component; }\nexport function defineIcon(iconName, iconNode) { return wrapIcon(IconBase, iconName, iconNode); }\n`, style);
  await writeJsx(dist, "createVadivamIcon.js", (paths) => `import Icon from "${paths.local("Icon")}";\nimport { wrapIcon } from "${paths.local("defineIcon")}";\nexport function createVadivamIcon(iconName, iconNode) { return wrapIcon(Icon, iconName, iconNode); }\nexport default createVadivamIcon;\n`, style);
  await write(dist, "createVadivamIcon.d.ts", `import type { IconNode, VadivamIcon } from "./types.js";\nexport declare function createVadivamIcon(iconName: string, iconNode: IconNode): VadivamIcon;\nexport default createVadivamIcon;\n`);
  for (const icon of icons) {
    await write(dist, `icons/${icon.name}.js`, `import { defineIcon } from "../defineIcon.js";\nexport const __iconNode = ${iconNode(icon)};\nexport default /* @__PURE__ */ defineIcon("${icon.name}", __iconNode);\n`);
    await write(dist, `icons/${icon.name}.d.ts`, `import type { IconNode, VadivamIcon } from "../types.js";\nexport declare const __iconNode: IconNode;\ndeclare const icon: VadivamIcon;\nexport default icon;\n`);
    await write(dist, `source/icons/${icon.name}.jsx`, `import { defineIcon } from "../defineIcon.jsx";\nexport const __iconNode = ${iconNode(icon)};\nexport default /* @__PURE__ */ defineIcon("${icon.name}", __iconNode);\n`);
  }
  await write(dist, "icons.js", `${iconImports(icons)}\nexport const icons = {\n${iconRegistryEntries(icons)}\n};\nexport default icons;\n`);
  await write(dist, "icons.d.ts", `import type { VadivamIcon } from "./types.js";\nexport declare const icons: {\n${iconRegistryTypes(icons, "VadivamIcon")}\n};\nexport default icons;\n`);
  await write(dist, "icons/index.js", `${iconExports(icons, { prefix: "./" })}\n`);
  await write(dist, "icons/index.d.ts", `${iconExports(icons, { prefix: "./" })}\n`);
  await write(dist, "source/icons.js", `${iconImports(icons, { extension: "jsx" })}\nexport const icons = {\n${iconRegistryEntries(icons)}\n};\nexport default icons;\n`);
  await write(dist, "source/icons/index.jsx", `${iconExports(icons, { prefix: "./", extension: "jsx" })}\n`);
  await write(dist, "dynamicIconImports.js", `const dynamicIconImports = {\n${dynamicEntries(icons)}\n};\nexport const iconNames = Object.keys(dynamicIconImports);\nexport { dynamicIconImports };\nexport default dynamicIconImports;\n`);
  await write(dist, "dynamicIconImports.d.ts", `import type { IconNode, VadivamIcon } from "./types.js";\nexport interface DynamicIconModule { default: VadivamIcon; __iconNode: IconNode; }\ndeclare const dynamicIconImports: {\n${dynamicTypes(icons)}\n};\nexport declare const iconNames: readonly (keyof typeof dynamicIconImports)[];\nexport { dynamicIconImports };\nexport default dynamicIconImports;\n`);
  await write(dist, "source/dynamicIconImports.js", `const dynamicIconImports = {\n${dynamicEntries(icons, { extension: "jsx" })}\n};\nexport const iconNames = Object.keys(dynamicIconImports);\nexport { dynamicIconImports };\nexport default dynamicIconImports;\n`);
  await writeJsx(dist, "dynamic.js", () => `import { createMemo, lazy, Show, splitProps, Suspense } from "solid-js";\nimport { Dynamic } from "solid-js/web";\nimport dynamicIconImports, { iconNames } from "./dynamicIconImports.js";\nexport function DynamicIcon(props) { const [local, rest] = splitProps(props, ["name", "fallback"]); const component = createMemo(() => { const importer = Object.prototype.hasOwnProperty.call(dynamicIconImports, local.name) ? dynamicIconImports[local.name] : undefined; return importer ? lazy(importer) : null; }); return <Show when={component()} fallback={local.fallback ?? null}>{(Loaded) => <Suspense fallback={local.fallback ?? null}><Dynamic component={Loaded()} {...rest} /></Suspense>}</Show>; }\nexport { dynamicIconImports, iconNames };\nexport default DynamicIcon;\n`, style);
  await write(dist, "dynamic.d.ts", dynamicDeclarations({ imports: `import type { JSX } from "solid-js";\n`, fallback: "JSX.Element", declaration: `export declare function DynamicIcon(props: DynamicIconProps): JSX.Element;` }));
  await writeExports(dist, "index", indexExports(icons, modulePaths(style, false)));
  await write(dist, "source/index.jsx", exportsSource(indexExports(icons, modulePaths(style, true), { extension: "jsx" })));
}
