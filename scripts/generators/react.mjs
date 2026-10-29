import {
  buildStyles,
  defaultAttributesSource,
  prepareDist,
  svgElementTypeSource,
  write,
  writeRuntimePolicy,
} from "./shared.mjs";

export async function buildReactPackage(icons, dist, solidIcons = []) {
  await prepareDist(dist);
  await writeRuntimePolicy(dist);
  await write(dist, "context.js", `"use client";\nimport React from "react";\n\nconst VadivamContext = React.createContext({});\nexport function VadivamProvider({ children, size, color, strokeWidth, absoluteStrokeWidth, className }) {\n  const value = React.useMemo(() => ({ size, color, strokeWidth, absoluteStrokeWidth, className }), [size, color, strokeWidth, absoluteStrokeWidth, className]);\n  return React.createElement(VadivamContext.Provider, { value }, children);\n}\nexport function useVadivamContext() {\n  return React.useContext(VadivamContext);\n}\n`);
  await write(dist, "context.d.ts", `import type * as React from "react";\nimport type { VadivamProps } from "./types.js";\nexport interface VadivamProviderProps extends Pick<VadivamProps, "size" | "color" | "strokeWidth" | "absoluteStrokeWidth" | "className"> { children: React.ReactNode; }\nexport declare function VadivamProvider(props: VadivamProviderProps): React.ReactElement;\nexport declare function useVadivamContext(): Partial<VadivamProps>;\n`);
  await buildStyles(dist, { outline: icons, solid: solidIcons }, buildReactEntry);
}

// An outline icon paints its stroke and scales its width; a solid icon paints
// its fill and has no stroke to scale.
function paintSource(style) {
  if (!style.stroked) {
    return {
      props: "strokeWidth: _strokeWidth, absoluteStrokeWidth: _absoluteStrokeWidth, ",
      pass: "",
      resolve: "",
      attributes: "      fill: paint(color ?? context.color),\n",
    };
  }
  return {
    props: "strokeWidth, absoluteStrokeWidth, ",
    pass: "strokeWidth, absoluteStrokeWidth, ",
    resolve: "  const resolvedStrokeWidth = strokeWidth ?? context.strokeWidth ?? 2;\n  const numericSize = Number(resolvedSize);\n  const numericStrokeWidth = Number(resolvedStrokeWidth);\n  const useAbsoluteStrokeWidth = absoluteStrokeWidth ?? context.absoluteStrokeWidth ?? false;\n  const calculatedStrokeWidth = useAbsoluteStrokeWidth && Number.isFinite(numericSize) && numericSize !== 0 && Number.isFinite(numericStrokeWidth) ? numericStrokeWidth * 24 / numericSize : resolvedStrokeWidth;\n",
    attributes: "      stroke: paint(color ?? context.color),\n      strokeWidth: calculatedStrokeWidth,\n",
  };
}

async function buildReactEntry(dist, icons, style) {
  const shared = style.shared;
  const paint = paintSource(style);
  const iconNameType = icons.map((icon) => JSON.stringify(icon.name)).join(" | ");
  await write(dist, "types.d.ts", `import type * as React from "react";\nexport type SVGElementType = ${svgElementTypeSource};\nexport type IconNode = readonly [tag: SVGElementType, attrs: Record<string, string | number | boolean>][];\nexport type SVGAttributes = Partial<React.SVGProps<SVGSVGElement>>;\nexport interface VadivamProps extends Omit<React.SVGProps<SVGSVGElement>, "color"${style.stroked ? "" : ' | "strokeWidth"'}> {\n  size?: string | number;\n  color?: string;\n${style.stroked ? "  strokeWidth?: string | number;\n  absoluteStrokeWidth?: boolean;\n" : ""}  title?: string;\n}\nexport type VadivamIcon = React.ForwardRefExoticComponent<Omit<VadivamProps, "ref"> & React.RefAttributes<SVGSVGElement>>;\nexport type IconName = ${iconNameType};\n`);
  await write(dist, "defaultAttributes.js", `const defaultAttributes = ${defaultAttributesSource(style, { camel: true })};\nexport default defaultAttributes;\n`);
  await write(dist, "IconBase.js", `"use client";\nimport React, { forwardRef } from "react";\nimport defaultAttributes from "./defaultAttributes.js";\nimport { useVadivamContext } from "${shared}context.js";\n\nfunction mergeClasses(...values) {\n  return values.flatMap((value) => typeof value === "string" ? value.split(/\\s+/) : []).filter((value, index, all) => value && all.indexOf(value) === index).join(" ");\n}\nfunction hasA11yProp(props) {\n  return Object.keys(props).some((name) => name.startsWith("aria-") || name === "role" || name === "title");\n}\nfunction toPaint(value) {\n  return typeof value === "string" || typeof value === "number" ? value : "currentColor";\n}\nfunction definedAttributes(props) {\n  const attrs = {};\n  for (const name of Object.keys(props)) if (props[name] != null) attrs[name] = props[name];\n  return attrs;\n}\nexport function renderNode([tag, attrs]) {\n  return React.createElement(tag, attrs);\n}\n\n// Shared by IconBase and the sanitizing Icon, so both render the same markup.\nexport function useIconSvg({ color, size, ${paint.props}className = "", title, children }, ref, rootAttributes, nodes, paint = toPaint) {\n  const context = useVadivamContext();\n  const resolvedSize = size ?? context.size ?? 24;\n${paint.resolve}  const labelled = Boolean(title) || hasA11yProp(rootAttributes);\n  return React.createElement(\n    "svg",\n    {\n      ref,\n      ...defaultAttributes,\n      width: resolvedSize,\n      height: resolvedSize,\n${paint.attributes}      className: mergeClasses("vadivam", context.className, className),\n      ...(!labelled ? { "aria-hidden": "true" } : {}),\n      ...(title ? { role: "img" } : {}),\n      ...rootAttributes\n    },\n    title ? React.createElement("title", { key: "title" }, title) : null,\n    ...nodes,\n    children\n  );\n}\n\n// Built-in icons only. Their nodes are checked against the runtime policy when\n// the package is generated, so they skip the sanitizer and their elements are\n// created once per icon.\nconst renderedNodes = new WeakMap();\nexport const IconBase = forwardRef(({ color, size, ${paint.props}className, title, children, iconNode, ...rest }, ref) => {\n  let nodes = renderedNodes.get(iconNode);\n  if (!nodes) renderedNodes.set(iconNode, nodes = iconNode.map(renderNode));\n  return useIconSvg({ color, size, ${paint.pass}className, title, children }, ref, definedAttributes(rest), nodes);\n});\nIconBase.displayName = "IconBase";\n`);
  await write(dist, "Icon.js", `"use client";\nimport { forwardRef } from "react";\nimport { renderNode, useIconSvg } from "./IconBase.js";\nimport { sanitizeIconNode, sanitizePaint, sanitizeRootAttributes } from "${shared}runtimePolicy.js";\n\n// Renders caller-supplied icon nodes, so nodes, root props and paint are sanitized on every render.\nexport const Icon = forwardRef(({ color, size, ${paint.props}className, title, children, iconNode, ...rest }, ref) =>\n  useIconSvg({ color, size, ${paint.pass}className, title, children }, ref, sanitizeRootAttributes(rest, true), sanitizeIconNode(iconNode).map(renderNode), sanitizePaint)\n);\nIcon.displayName = "Icon";\nexport default Icon;\n`);
  await write(dist, "Icon.d.ts", `import type * as React from "react";\nimport type { IconNode, VadivamProps } from "./types.js";\nexport interface IconProps extends VadivamProps { iconNode: IconNode; }\nexport declare const Icon: React.ForwardRefExoticComponent<Omit<IconProps, "ref"> & React.RefAttributes<SVGSVGElement>>;\nexport default Icon;\n`);
  await write(dist, "createIcon.js", `import Icon from "./Icon.js";\nimport { wrapIcon } from "./defineIcon.js";\n\nfunction toKebabCase(value) {\n  return value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[ _]+/g, "-").toLowerCase();\n}\nfunction toPascalCase(value) {\n  return value.split(/[-_ ]+/).filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join("");\n}\nexport function createIcon(iconName, iconNode) {\n  return wrapIcon(Icon, \`vadivam-\${toKebabCase(iconName)}\`, toPascalCase(iconName), iconNode);\n}\nexport const createVadivamIcon = createIcon;\n`);
  await write(dist, "createIcon.d.ts", `import type { IconNode, VadivamIcon } from "./types.js";\nexport declare function createIcon(iconName: string, iconNode: IconNode): VadivamIcon;\nexport { createIcon as createVadivamIcon };\n`);
  await write(dist, "defineIcon.js", `import React, { forwardRef } from "react";\nimport { IconBase } from "./IconBase.js";\n\nexport function wrapIcon(Base, iconClass, displayName, iconNode) {\n  const Component = forwardRef(({ className, ...props }, ref) => React.createElement(Base, { ...props, ref, iconNode, className: [iconClass, className].filter(Boolean).join(" ") }));\n  Component.displayName = displayName;\n  return Component;\n}\nexport function defineIcon(name, displayName, iconNode) {\n  return wrapIcon(IconBase, \`vadivam-\${name}\`, displayName, iconNode);\n}\n`);

  for (const icon of icons) {
    await write(dist, `icons/${icon.name}.js`, `import { defineIcon } from "../defineIcon.js";\nexport const __iconNode = ${JSON.stringify(icon.iconNode)};\nconst ${icon.componentName} = /* @__PURE__ */ defineIcon("${icon.name}", "${icon.componentName}", __iconNode);\nexport default ${icon.componentName};\n`);
    await write(dist, `icons/${icon.name}.d.ts`, `import type { IconNode, VadivamIcon } from "../types.js";\nexport declare const __iconNode: IconNode;\n/** @component\n * @name ${icon.componentName}\n * @description Vadivam ${style.stroked ? "" : "solid "}SVG icon component.\n * @see https://vadivam.praveenjuge.com/icons/${icon.name}\n */\ndeclare const ${icon.componentName}: VadivamIcon;\nexport default ${icon.componentName};\n`);
  }

  const namedExports = icons
    .map((icon) => `export { default as ${icon.componentName}, default as ${icon.componentName}Icon, default as Vadivam${icon.componentName} } from "./icons/${icon.name}.js";`)
    .join("\n");
  const dynamicEntries = icons.map((icon) => `  "${icon.name}": () => import("./icons/${icon.name}.js")`).join(",\n");
  const dynamicTypes = icons.map((icon) => `  readonly "${icon.name}": () => Promise<DynamicIconModule>;`).join("\n");
  const reactImports = icons.map((icon) => `import ${icon.componentName} from "./icons/${icon.name}.js";`).join("\n");
  const reactIconEntries = icons.map((icon) => `  ${icon.componentName}`).join(",\n");
  const reactIconTypes = icons.map((icon) => `  readonly ${icon.componentName}: VadivamIcon;`).join("\n");
  await write(dist, "icons.js", `${reactImports}\n\nexport const icons = {\n${reactIconEntries}\n};\nexport default icons;\n`);
  await write(dist, "icons.d.ts", `import type { VadivamIcon } from "./types.js";\nexport declare const icons: {\n${reactIconTypes}\n};\nexport default icons;\n`);
  await write(dist, "index.js", `${namedExports}\nexport { Icon } from "./Icon.js";\nexport { createIcon, createVadivamIcon } from "./createIcon.js";\nexport { icons } from "./icons.js";\nexport { VadivamProvider, useVadivamContext } from "${shared}context.js";\n`);
  await write(dist, "index.d.ts", `${namedExports}\nexport { Icon } from "./Icon.js";\nexport { createIcon, createVadivamIcon } from "./createIcon.js";\nexport { icons } from "./icons.js";\nexport { VadivamProvider, useVadivamContext } from "${shared}context.js";\nexport type { IconName, IconNode, SVGAttributes, SVGElementType, VadivamIcon, VadivamProps } from "./types.js";\n`);
  await write(dist, "dynamicIconImports.js", `const dynamicIconImports = {\n${dynamicEntries}\n};\nexport { dynamicIconImports };\nexport default dynamicIconImports;\n`);
  await write(dist, "dynamicIconImports.d.ts", `import type { IconNode, VadivamIcon } from "./types.js";\nexport interface DynamicIconModule { default: VadivamIcon; __iconNode: IconNode; }\ndeclare const dynamicIconImports: {\n${dynamicTypes}\n};\nexport { dynamicIconImports };\nexport default dynamicIconImports;\n`);
  await write(dist, "dynamic.js", `"use client";\nimport React, { forwardRef } from "react";\nimport dynamicIconImports from "./dynamicIconImports.js";\nimport { sanitizePaint, sanitizeRootAttributes } from "${shared}runtimePolicy.js";\nimport { useVadivamContext } from "${shared}context.js";\n\nexport const iconNames = Object.keys(dynamicIconImports);\n// Names and props here often come from runtime data, so this entry keeps the\n// root-prop and paint sanitizer that statically imported icons skip. Paint\n// includes a color inherited from VadivamProvider.\nexport const DynamicIcon = forwardRef(({ name, fallback = null, color: ownColor, size, ${paint.props}className, title, children, ...rest }, ref) => {\n  const importer = Object.prototype.hasOwnProperty.call(dynamicIconImports, name) ? dynamicIconImports[name] : undefined;\n  const Component = React.useMemo(() => importer ? React.lazy(importer) : null, [importer]);\n  const context = useVadivamContext();\n  const color = ownColor ?? context.color;\n  if (!Component) return fallback;\n  const props = { ...sanitizeRootAttributes(rest, true), color: color == null ? color : sanitizePaint(color), size, ${paint.pass}className, title, ref };\n  return React.createElement(React.Suspense, { fallback }, React.createElement(Component, props, children));\n});\nDynamicIcon.displayName = "DynamicIcon";\nexport { dynamicIconImports };\nexport default DynamicIcon;\n`);
  await write(dist, "dynamic.d.ts", `import type * as React from "react";\nimport type { IconName, VadivamProps } from "./types.js";\nimport dynamicIconImports from "./dynamicIconImports.js";\nexport interface DynamicIconProps extends Omit<VadivamProps, "ref"> {\n  name: IconName;\n  fallback?: React.ReactNode;\n}\nexport declare const iconNames: IconName[];\nexport declare const DynamicIcon: React.ForwardRefExoticComponent<DynamicIconProps & React.RefAttributes<SVGSVGElement>>;\nexport { dynamicIconImports };\nexport type { DynamicIconModule } from "./dynamicIconImports.js";\nexport type { IconName } from "./types.js";\nexport default DynamicIcon;\n`);
}
