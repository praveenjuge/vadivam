import { transformAsync } from "@babel/core";
import solidPreset from "babel-preset-solid";
import {
  dynamicEntries,
  dynamicTypes,
  iconExports,
  iconImports,
  iconNameType,
  iconNode,
  iconRegistryEntries,
  iconRegistryTypes,
  prepareDist,
  write,
} from "./shared.mjs";

async function writeJsx(dist, relativePath, source) {
  const sourcePath = `source/${relativePath.replace(/\.js$/, ".jsx")}`;
  const sourceCode = source
    .replaceAll("./context.js", "./context.jsx")
    .replaceAll("./Icon.js", "./Icon.jsx");
  await write(dist, sourcePath, sourceCode);
  const result = await transformAsync(source, {
    filename: relativePath,
    presets: [[solidPreset, { generate: "ssr", hydratable: true }]],
    sourceMaps: false,
  });
  await write(dist, relativePath, `${result.code}\n`);
}

export async function buildSolidPackage(icons, dist) {
  await prepareDist(dist);
  await write(dist, "types.d.ts", `import type { Component, JSX } from "solid-js";\nexport type SVGElementType = "circle" | "ellipse" | "line" | "path" | "polygon" | "polyline" | "rect";\nexport type IconNode = readonly [tag: SVGElementType, attrs: Record<string, string>][];\nexport interface VadivamProps extends JSX.SvgSVGAttributes<SVGSVGElement> { name?: string; size?: string | number; color?: string; strokeWidth?: string | number; absoluteStrokeWidth?: boolean; title?: string; iconNode?: IconNode; }\nexport type VadivamIcon = Component<VadivamProps>;\nexport type IconName = ${iconNameType(icons)};\n`);
  await write(dist, "defaultAttributes.js", `export default { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" };\n`);
  await write(dist, "source/defaultAttributes.js", `export { default } from "../defaultAttributes.js";\n`);
  await writeJsx(dist, "context.js", `import { createContext, splitProps, useContext } from "solid-js";\nexport const VadivamContext = createContext({});\nexport function VadivamProvider(props) { const [value, rest] = splitProps(props, ["size", "color", "strokeWidth", "absoluteStrokeWidth", "class"]); return <VadivamContext.Provider value={value}>{rest.children}</VadivamContext.Provider>; }\nexport function useVadivamContext() { return useContext(VadivamContext); }\n`);
  await write(dist, "context.d.ts", `import type { JSX } from "solid-js";\nimport type { VadivamProps } from "./types.js";\nexport interface VadivamProviderProps extends Pick<VadivamProps, "size" | "color" | "strokeWidth" | "absoluteStrokeWidth" | "class"> { children: JSX.Element; }\nexport declare function VadivamProvider(props: VadivamProviderProps): JSX.Element;\nexport declare function useVadivamContext(): Partial<VadivamProps>;\n`);
  await writeJsx(dist, "Icon.js", `import { For, splitProps } from "solid-js";\nimport { Dynamic } from "solid-js/web";\nimport defaultAttributes from "./defaultAttributes.js";\nimport { useVadivamContext } from "./context.js";\nfunction classes(...values) { return values.flatMap((value) => typeof value === "string" ? value.split(/\\s+/) : []).filter((value, index, all) => value && all.indexOf(value) === index).join(" "); }\nfunction hasA11y(props) { return Object.keys(props).some((name) => name.startsWith("aria-") || name === "role" || name === "title"); }\nexport function Icon(props) { const [local, rest] = splitProps(props, ["color", "size", "strokeWidth", "absoluteStrokeWidth", "children", "iconNode", "name", "title", "class"]); const context = useVadivamContext(); const resolvedSize = () => local.size ?? context.size ?? 24; const resolvedStroke = () => local.strokeWidth ?? context.strokeWidth ?? 2; const calculated = () => { const size = Number(resolvedSize()); const stroke = Number(resolvedStroke()); const absolute = local.absoluteStrokeWidth ?? context.absoluteStrokeWidth ?? false; return absolute && Number.isFinite(size) && size !== 0 && Number.isFinite(stroke) ? stroke * 24 / size : resolvedStroke(); }; return <svg {...defaultAttributes} width={resolvedSize()} height={resolvedSize()} stroke={local.color ?? context.color ?? "currentColor"} stroke-width={calculated()} class={classes("vadivam", local.name && "vadivam-" + local.name, context.class, local.class)} aria-hidden={!local.title && !hasA11y(rest) ? "true" : undefined} role={local.title ? "img" : rest.role} {...rest}>{local.title ? <title>{local.title}</title> : null}<For each={local.iconNode ?? []}>{([tag, attrs]) => <Dynamic component={tag} {...attrs} />}</For>{local.children}</svg>; }\nexport default Icon;\n`);
  await write(dist, "Icon.d.ts", `import type { JSX } from "solid-js";\nimport type { VadivamProps } from "./types.js";\nexport declare function Icon(props: VadivamProps): JSX.Element;\nexport default Icon;\n`);
  await writeJsx(dist, "createVadivamIcon.js", `import Icon from "./Icon.js";\nexport function createVadivamIcon(iconName, iconNode) { const Component = (props) => <Icon {...props} name={iconName} iconNode={iconNode} />; return Component; }\nexport default createVadivamIcon;\n`);
  await write(dist, "createVadivamIcon.d.ts", `import type { IconNode, VadivamIcon } from "./types.js";\nexport declare function createVadivamIcon(iconName: string, iconNode: IconNode): VadivamIcon;\nexport default createVadivamIcon;\n`);
  for (const icon of icons) {
    await write(dist, `icons/${icon.name}.js`, `import { createVadivamIcon } from "../createVadivamIcon.js";\nexport const __iconNode = ${iconNode(icon)};\nexport default createVadivamIcon("${icon.name}", __iconNode);\n`);
    await write(dist, `icons/${icon.name}.d.ts`, `import type { IconNode, VadivamIcon } from "../types.js";\nexport declare const __iconNode: IconNode;\ndeclare const icon: VadivamIcon;\nexport default icon;\n`);
    await write(dist, `source/icons/${icon.name}.jsx`, `import { createVadivamIcon } from "../createVadivamIcon.jsx";\nexport const __iconNode = ${iconNode(icon)};\nexport default createVadivamIcon("${icon.name}", __iconNode);\n`);
  }
  await write(dist, "icons.js", `${iconImports(icons)}\nexport const icons = {\n${iconRegistryEntries(icons)}\n};\nexport default icons;\n`);
  await write(dist, "icons.d.ts", `import type { VadivamIcon } from "./types.js";\nexport declare const icons: {\n${iconRegistryTypes(icons, "VadivamIcon")}\n};\nexport default icons;\n`);
  await write(dist, "icons/index.js", `${iconExports(icons, "./")}\n`);
  await write(dist, "icons/index.d.ts", `${iconExports(icons, "./")}\n`);
  await write(dist, "source/icons.js", `${icons.map(({ componentName, name }) => `import ${componentName} from "./icons/${name}.jsx";`).join("\n")}\nexport const icons = {\n${iconRegistryEntries(icons)}\n};\nexport default icons;\n`);
  await write(dist, "source/icons/index.jsx", `${icons.map(({ componentName, name }) => `export { default as ${componentName}, default as ${componentName}Icon, default as Vadivam${componentName} } from "./${name}.jsx";`).join("\n")}\n`);
  await write(dist, "dynamicIconImports.js", `const dynamicIconImports = {\n${dynamicEntries(icons)}\n};\nexport const iconNames = Object.keys(dynamicIconImports);\nexport { dynamicIconImports };\nexport default dynamicIconImports;\n`);
  await write(dist, "dynamicIconImports.d.ts", `import type { IconNode, VadivamIcon } from "./types.js";\nexport interface DynamicIconModule { default: VadivamIcon; __iconNode: IconNode; }\ndeclare const dynamicIconImports: {\n${dynamicTypes(icons)}\n};\nexport declare const iconNames: readonly (keyof typeof dynamicIconImports)[];\nexport { dynamicIconImports };\nexport default dynamicIconImports;\n`);
  await write(dist, "source/dynamicIconImports.js", `const dynamicIconImports = {\n${dynamicEntries(icons, "jsx")}\n};\nexport const iconNames = Object.keys(dynamicIconImports);\nexport { dynamicIconImports };\nexport default dynamicIconImports;\n`);
  await writeJsx(dist, "dynamic.js", `import { createMemo, lazy, Show, splitProps, Suspense } from "solid-js";\nimport { Dynamic } from "solid-js/web";\nimport dynamicIconImports, { iconNames } from "./dynamicIconImports.js";\nexport function DynamicIcon(props) { const [local, rest] = splitProps(props, ["name", "fallback"]); const component = createMemo(() => { const importer = dynamicIconImports[local.name]; return importer ? lazy(importer) : null; }); return <Show when={component()} fallback={local.fallback ?? null}>{(Loaded) => <Suspense fallback={local.fallback ?? null}><Dynamic component={Loaded()} {...rest} /></Suspense>}</Show>; }\nexport { dynamicIconImports, iconNames };\nexport default DynamicIcon;\n`);
  await write(dist, "dynamic.d.ts", `import type { JSX } from "solid-js";\nimport type { IconName, VadivamProps } from "./types.js";\nexport interface DynamicIconProps extends VadivamProps { name: IconName; fallback?: JSX.Element; }\nexport declare function DynamicIcon(props: DynamicIconProps): JSX.Element;\nexport { default as dynamicIconImports, iconNames } from "./dynamicIconImports.js";\nexport default DynamicIcon;\n`);
  const exports = iconExports(icons);
  await write(dist, "index.js", `${exports}\nexport { Icon } from "./Icon.js";\nexport { createVadivamIcon } from "./createVadivamIcon.js";\nexport { icons } from "./icons.js";\nexport { VadivamContext, VadivamProvider, useVadivamContext } from "./context.js";\nexport { dynamicIconImports, iconNames } from "./dynamicIconImports.js";\n`);
  await write(dist, "index.d.ts", `${exports}\nexport { Icon } from "./Icon.js";\nexport { createVadivamIcon } from "./createVadivamIcon.js";\nexport { icons } from "./icons.js";\nexport { VadivamContext, VadivamProvider, useVadivamContext } from "./context.js";\nexport { dynamicIconImports, iconNames } from "./dynamicIconImports.js";\nexport type { IconName, IconNode, SVGElementType, VadivamIcon, VadivamProps } from "./types.js";\n`);
  const sourceExports = icons.map(({ componentName, name }) => `export { default as ${componentName}, default as ${componentName}Icon, default as Vadivam${componentName} } from "./icons/${name}.jsx";`).join("\n");
  await write(dist, "source/index.jsx", `${sourceExports}\nexport { Icon } from "./Icon.jsx";\nexport { createVadivamIcon } from "./createVadivamIcon.jsx";\nexport { icons } from "./icons.js";\nexport { VadivamContext, VadivamProvider, useVadivamContext } from "./context.jsx";\nexport { dynamicIconImports, iconNames } from "./dynamicIconImports.js";\n`);
}
