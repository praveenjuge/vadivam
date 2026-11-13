import path from "node:path";
import { pascalCase, svgElementTypes } from "../icon-styles.mjs";
import {
  buildStyles,
  camelCase,
  defaultAttributesSource,
  defaultSize,
  defaultStrokeWidth,
  dynamicDeclarations,
  dynamicEntries,
  dynamicExports,
  dynamicTypes,
  exportedNames,
  iconExports,
  iconNameType,
  keyedIconNode,
  objectEntries,
  paintBindings,
  prepareDist,
  scaledStrokeWidthSource,
  svgElementTypeSource,
  write,
  writeExports,
} from "./shared.mjs";

const indexExports = (icons, shared) => [
  { icons },
  { from: "./Icon.js", values: ["Icon"] },
  { from: "./Icon.js", types: ["IconProps"] },
  { from: "./createVadivamIcon.js", values: ["createVadivamIcon"] },
  { from: `${shared}context.js`, values: ["VadivamProvider", "useVadivamContext"] },
  { from: `${shared}context.js`, types: ["VadivamProviderProps"] },
  { from: "./dynamicIconImports.js", values: ["dynamicIconImports", "iconNames"] },
  { from: "./types.js", types: ["IconName", "IconNode", "SVGElementType", "VadivamIcon", "VadivamProps"] },
];

/** Every name the root and dynamic entries export besides the icons. */
export const apiExports = [...exportedNames(indexExports([], "./")), ...dynamicExports];

// react-native-svg's component for each element an icon draws with.
const primitives = `{ ${svgElementTypes.map((tag) => `${tag}: NativeSvg.${pascalCase(tag)}`).join(", ")} }`;

export async function build({ iconsByStyle, directory }) {
  const dist = path.join(directory, "dist");
  await prepareDist(dist);
  await write(dist, "context.js", `import React from "react";\nconst VadivamContext = React.createContext({});\nexport function VadivamProvider({ children, size, color, strokeWidth, absoluteStrokeWidth }) {\n  const value = React.useMemo(() => ({ size, color, strokeWidth, absoluteStrokeWidth }), [size, color, strokeWidth, absoluteStrokeWidth]);\n  return React.createElement(VadivamContext.Provider, { value }, children);\n}\nexport function useVadivamContext() { return React.useContext(VadivamContext); }\n`);
  await write(dist, "context.d.ts", `import type * as React from "react";\nimport type { VadivamProps } from "./types.js";\nexport interface VadivamProviderProps extends Pick<VadivamProps, "size" | "color" | "strokeWidth" | "absoluteStrokeWidth"> { children: React.ReactNode; }\nexport declare function VadivamProvider(props: VadivamProviderProps): React.ReactElement;\nexport declare function useVadivamContext(): Partial<VadivamProps>;\n`);
  await buildStyles(dist, iconsByStyle, buildReactNativeEntry);
}

async function buildReactNativeEntry(dist, icons, style) {
  const shared = style.shared;
  // Shapes repeat the root's paint, since react-native-svg children don't inherit it from the Svg.
  const childDefaults = Object.keys(style.paint).map((name) => camelCase(name)).map((name) => `${name}: defaultAttributes.${name}`).join(", ");
  const paint = objectEntries(paintBindings(style, {
    color: `color ?? context.color ?? "currentColor"`,
    strokeWidth: `strokeWidth ?? context.strokeWidth ?? ${defaultStrokeWidth}`,
    size: "resolvedSize",
    absolute: "absoluteStrokeWidth ?? context.absoluteStrokeWidth ?? false",
  }), { camel: true });
  await write(dist, "types.d.ts", `import type * as React from "react";\nimport type { Svg, SvgProps } from "react-native-svg";\nexport type SVGElementType = ${svgElementTypeSource};\nexport type IconNode = readonly [tag: SVGElementType, attrs: Record<string, string>][];\nexport interface VadivamProps extends ${style.stroked ? "SvgProps" : 'Omit<SvgProps, "strokeWidth">'} { size?: string | number;${style.stroked ? " absoluteStrokeWidth?: boolean;" : ""} title?: string; "data-testid"?: string; }\nexport type VadivamIcon = React.ForwardRefExoticComponent<VadivamProps & React.RefAttributes<Svg>>;\nexport type IconName = ${iconNameType(icons)};\n`);
  await write(dist, "defaultAttributes.js", `const defaultAttributes = ${defaultAttributesSource(style, { camel: true })};\nexport const childDefaultAttributes = { ${childDefaults} };\nexport default defaultAttributes;\n`);
  await write(dist, "Icon.js", `import React, { forwardRef } from "react";\nimport * as NativeSvg from "react-native-svg";\nimport defaultAttributes, { childDefaultAttributes } from "./defaultAttributes.js";\nimport { useVadivamContext } from "${shared}context.js";\nconst primitives = ${primitives};\n${style.stroked ? `${scaledStrokeWidthSource()}\n` : ""}function renderNode([tag, attrs], customAttrs) { return React.createElement(primitives[tag], { ...childDefaultAttributes, ...customAttrs, ...attrs }); }\nexport const Icon = forwardRef(({ color, size, strokeWidth, absoluteStrokeWidth, children, iconNode, title, className, testID, ...rest }, ref) => {\n  const context = useVadivamContext() ?? {};\n  const resolvedSize = size ?? context.size ?? ${defaultSize};\n  const customAttrs = { ${paint}, ...rest };\n  return React.createElement(NativeSvg.Svg, { ref, ...defaultAttributes, width: resolvedSize, height: resolvedSize, testID, "data-testid": testID, className, accessibilityRole: title ? "image" : rest.accessibilityRole, ...customAttrs }, ...iconNode.map((node) => renderNode(node, customAttrs)), title ? React.createElement(NativeSvg.Title, null, title) : null, ...React.Children.toArray(children));\n});\nIcon.displayName = "Icon";\nexport default Icon;\n`);
  await write(dist, "Icon.d.ts", `import type * as React from "react";\nimport type { Svg } from "react-native-svg";\nimport type { IconNode, VadivamProps } from "./types.js";\nexport interface IconProps extends VadivamProps { iconNode: IconNode; }\nexport declare const Icon: React.ForwardRefExoticComponent<IconProps & React.RefAttributes<Svg>>;\nexport default Icon;\n`);
  await write(dist, "createVadivamIcon.js", `import React, { forwardRef } from "react";\nimport Icon from "./Icon.js";\nexport function createVadivamIcon(iconName, iconNode) { const Component = forwardRef((props, ref) => React.createElement(Icon, { ref, iconNode, ...props })); Component.displayName = iconName.split(/[-_ ]+/).filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join(""); return Component; }\nexport default createVadivamIcon;\n`);
  await write(dist, "createVadivamIcon.d.ts", `import type { IconNode, VadivamIcon } from "./types.js";\nexport declare function createVadivamIcon(iconName: string, iconNode: IconNode): VadivamIcon;\nexport default createVadivamIcon;\n`);
  for (const icon of icons) {
    await write(dist, `icons/${icon.name}.js`, `import { createVadivamIcon } from "../createVadivamIcon.js";\nexport const __iconNode = ${keyedIconNode(icon)};\nconst ${icon.componentName} = createVadivamIcon("${icon.name}", __iconNode);\nexport default ${icon.componentName};\n`);
    await write(dist, `icons/${icon.name}.d.ts`, `import type { IconNode, VadivamIcon } from "../types.js";\nexport declare const __iconNode: IconNode;\ndeclare const ${icon.componentName}: VadivamIcon;\nexport default ${icon.componentName};\n`);
  }
  await write(dist, "icons/index.js", `${iconExports(icons, { prefix: "./" })}\n`);
  await write(dist, "icons/index.d.ts", `${iconExports(icons, { prefix: "./" })}\n`);
  await write(dist, "dynamicIconImports.js", `const dynamicIconImports = {\n${dynamicEntries(icons)}\n};\nexport const iconNames = Object.keys(dynamicIconImports);\nexport { dynamicIconImports };\nexport default dynamicIconImports;\n`);
  await write(dist, "dynamicIconImports.d.ts", `import type { IconNode, VadivamIcon } from "./types.js";\nexport interface DynamicIconModule { default: VadivamIcon; __iconNode: IconNode; }\ndeclare const dynamicIconImports: {\n${dynamicTypes(icons)}\n};\nexport declare const iconNames: readonly (keyof typeof dynamicIconImports)[];\nexport { dynamicIconImports };\nexport default dynamicIconImports;\n`);
  await write(dist, "dynamic.js", `import React, { forwardRef } from "react";\nimport dynamicIconImports, { iconNames } from "./dynamicIconImports.js";\nexport const DynamicIcon = forwardRef(({ name, fallback = null, ...props }, ref) => { const importer = Object.prototype.hasOwnProperty.call(dynamicIconImports, name) ? dynamicIconImports[name] : undefined; const Component = React.useMemo(() => importer ? React.lazy(importer) : null, [importer]); if (!Component) return fallback; return React.createElement(React.Suspense, { fallback }, React.createElement(Component, { ...props, ref })); });\nDynamicIcon.displayName = "DynamicIcon";\nexport { dynamicIconImports, iconNames };\nexport default DynamicIcon;\n`);
  await write(dist, "dynamic.d.ts", dynamicDeclarations({ imports: `import type * as React from "react";\nimport type { Svg } from "react-native-svg";\n`, fallback: "React.ReactNode", declaration: `export declare const DynamicIcon: React.ForwardRefExoticComponent<DynamicIconProps & React.RefAttributes<Svg>>;` }));
  await writeExports(dist, "index", indexExports(icons, shared));
}
