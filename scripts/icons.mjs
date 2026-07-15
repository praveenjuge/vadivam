import {
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
  copyFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { optimize } from "svgo";
import { Resvg } from "@resvg/resvg-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = path.join(root, "icons");
const rawDist = path.join(root, "packages/vadivam/dist");
const reactDist = path.join(root, "packages/vadivam-react/dist");
const webIconsDir = path.join(root, "apps/web/public/icons");
const previewPath = path.join(root, "apps/web/public/preview.png");
const ogPath = path.join(root, "apps/web/public/og.png");
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

const graphics = new Set([
  "path",
  "circle",
  "line",
  "polyline",
  "polygon",
  "rect",
  "ellipse",
]);
const geometryAttrs = {
  path: new Set(["@_d"]),
  circle: new Set(["@_cx", "@_cy", "@_r"]),
  line: new Set(["@_x1", "@_y1", "@_x2", "@_y2"]),
  polyline: new Set(["@_points"]),
  polygon: new Set(["@_points"]),
  rect: new Set(["@_x", "@_y", "@_width", "@_height", "@_rx", "@_ry"]),
  ellipse: new Set(["@_cx", "@_cy", "@_rx", "@_ry"]),
};
const rootAttrs = {
  "@_xmlns": "http://www.w3.org/2000/svg",
  "@_width": "24",
  "@_height": "24",
  "@_viewBox": "0 0 24 24",
  "@_fill": "none",
  "@_stroke": "currentColor",
  "@_stroke-width": "2",
  "@_stroke-linecap": "round",
  "@_stroke-linejoin": "round",
};
const blockedTags = new Set([
  "a",
  "clipPath",
  "defs",
  "filter",
  "foreignObject",
  "g",
  "image",
  "linearGradient",
  "mask",
  "pattern",
  "radialGradient",
  "script",
  "style",
  "symbol",
  "text",
  "use",
]);

async function svgFiles() {
  return (await readdir(iconsDir))
    .filter((file) => file.endsWith(".svg"))
    .sort();
}

function pascalCase(name) {
  return name
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseSvg(svg, file = "inline.svg") {
  const xmlCheck = XMLValidator.validate(svg);
  assert(xmlCheck === true, `${file}: invalid XML ${JSON.stringify(xmlCheck)}`);
  const parsed = parser.parse(svg);
  assert(
    parsed.svg && typeof parsed.svg === "object",
    `${file}: missing <svg> root`,
  );
  return parsed.svg;
}

function asArray(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export function validateSvgContent(svg, file = "inline.svg") {
  const node = parseSvg(svg, file);
  for (const [attr, value] of Object.entries(rootAttrs)) {
    assert(
      node[attr] === value,
      `${file}: expected ${attr.slice(2)}="${value}"`,
    );
  }
  for (const key of Object.keys(node)) {
    if (key.startsWith("@_"))
      assert(
        key in rootAttrs,
        `${file}: unsupported root attribute ${key.slice(2)}`,
      );
  }

  let count = 0;
  const visit = (current, parentTag) => {
    for (const [tag, value] of Object.entries(current)) {
      if (tag.startsWith("@_")) continue;
      assert(!blockedTags.has(tag), `${file}: unsupported <${tag}> element`);
      assert(graphics.has(tag), `${file}: unsupported <${tag}> element`);
      for (const item of asArray(value)) {
        count += 1;
        assert(
          item && typeof item === "object",
          `${file}: invalid <${tag}> element`,
        );
        const allowed = geometryAttrs[tag];
        for (const attr of Object.keys(item)) {
          if (attr.startsWith("@_")) {
            assert(
              allowed.has(attr),
              `${file}: unsupported ${tag} attribute ${attr.slice(2)}`,
            );
          } else {
            visit({ [attr]: item[attr] }, tag);
          }
        }
        assert(
          Object.keys(item).some((attr) => allowed.has(attr)),
          `${file}: <${tag}> has no geometry`,
        );
      }
    }
  };

  visit(node, "svg");
  assert(count > 0, `${file}: no drawable elements found`);
}

function iconNodeFromSvg(svg, file) {
  const node = parseSvg(svg, file);
  const iconNode = [];
  for (const tag of graphics) {
    for (const item of asArray(node[tag])) {
      const attrs = {};
      for (const [attr, value] of Object.entries(item)) {
        if (geometryAttrs[tag].has(attr)) attrs[attr.slice(2)] = value;
      }
      attrs.key = `${tag}-${iconNode.length}`;
      iconNode.push([tag, attrs]);
    }
  }
  return iconNode;
}

export function normalizeSvg(svg, file) {
  const result = optimize(svg, {
    path: file,
    multipass: true,
    plugins: [
      {
        name: "preset-default",
        params: {
          overrides: {
            cleanupIds: false,
            convertShapeToPath: false,
          },
        },
      },
    ],
  });
  if (result.error) throw new Error(`${file}: ${result.error}`);
  const open = result.data.match(/<svg\b[^>]*>/);
  const close = result.data.lastIndexOf("</svg>");
  assert(open && close > -1, `${file}: optimized SVG is missing root`);
  const inner = result.data
    .slice(open.index + open[0].length, close)
    .replace(
      /\s(?:fill|stroke|stroke-width|stroke-linecap|stroke-linejoin)="[^"]*"/g,
      "",
    )
    .trim();
  const normalized = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n${inner}\n</svg>\n`;
  validateSvgContent(normalized, file);
  return normalized;
}

export async function readIcons() {
  const files = await svgFiles();
  const icons = [];
  for (const fileName of files) {
    const name = fileName.replace(/\.svg$/, "");
    const filePath = path.join(iconsDir, fileName);
    const svg = await readFile(filePath, "utf8");
    validateSvgContent(svg, fileName);
    const iconNode = iconNodeFromSvg(svg, fileName);
    icons.push({
      name,
      componentName: pascalCase(name),
      fileName,
      svgPath: `icons/${fileName}`,
      svg,
      iconNode,
    });
  }
  return icons;
}

export async function optimizeIcons() {
  const files = await svgFiles();
  for (const fileName of files) {
    const filePath = path.join(iconsDir, fileName);
    const svg = await readFile(filePath, "utf8");
    await writeFile(filePath, normalizeSvg(svg, fileName));
  }
  console.log(`Optimized ${files.length} icons.`);
}

export async function checkIcons() {
  const files = await svgFiles();
  for (const fileName of files) {
    validateSvgContent(
      await readFile(path.join(iconsDir, fileName), "utf8"),
      fileName,
    );
  }
  console.log(`Checked ${files.length} icons.`);
}

async function buildRawPackage(icons) {
  await rm(rawDist, { recursive: true, force: true });
  await mkdir(path.join(rawDist, "icons"), { recursive: true });
  for (const icon of icons) {
    const rawIconNode = icon.iconNode.map(([tag, attrs]) => [
      tag,
      Object.fromEntries(
        Object.entries(attrs).filter(([name]) => name !== "key"),
      ),
    ]);
    await copyFile(
      path.join(iconsDir, icon.fileName),
      path.join(rawDist, "icons", icon.fileName),
    );
    await writeFile(
      path.join(rawDist, "icons", `${icon.name}.js`),
      `const ${icon.componentName} = ${JSON.stringify(rawIconNode)};\nexport default ${icon.componentName};\n`,
    );
    await writeFile(
      path.join(rawDist, "icons", `${icon.name}.d.ts`),
      `import type { IconNode } from "../types.js";\n/** @name ${icon.name}\n * @description Vadivam SVG icon node.\n * @see https://vadivam.praveenjuge.com/icons/${icon.name}\n */\ndeclare const ${icon.componentName}: IconNode;\nexport default ${icon.componentName};\n`,
    );
  }
  const iconNameType = icons.map((icon) => JSON.stringify(icon.name)).join(" | ");
  const rawImports = icons
    .map(
      (icon) =>
        `import ${icon.componentName} from "./icons/${icon.name}.js";`,
    )
    .join("\n");
  const rawNamedExports = icons
    .map(
      (icon) =>
        `export { default as ${icon.componentName} } from "./icons/${icon.name}.js";`,
    )
    .join("\n");
  const rawIconEntries = icons
    .map((icon) => `  ${icon.componentName}`)
    .join(",\n");
  const rawIconTypes = icons
    .map((icon) => `  readonly ${icon.componentName}: IconNode;`)
    .join("\n");
  await writeFile(
    path.join(rawDist, "types.d.ts"),
    `export type SVGProps = Record<string, string | number | undefined>;\nexport type IconNode = readonly [tag: string, attrs: SVGProps, children?: IconNode][];\nexport type Icons = Record<string, IconNode>;\nexport type IconName = ${iconNameType};\n`,
  );
  await writeFile(
    path.join(rawDist, "defaultAttributes.js"),
    `const defaultAttributes = { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" };\nexport default defaultAttributes;\n`,
  );
  await writeFile(
    path.join(rawDist, "createElement.js"),
    `import defaultAttributes from "./defaultAttributes.js";\n\nconst unsafeAttribute = /^(?:on|href$|xlink:href$|src$)/i;\nfunction createSvgElement(document, [tag, attrs, children]) {\n  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);\n  for (const [name, value] of Object.entries(attrs)) {\n    if (value !== undefined && !unsafeAttribute.test(name)) element.setAttribute(name, String(value));\n  }\n  for (const child of children ?? []) element.appendChild(createSvgElement(document, child));\n  return element;\n}\n\nexport function createElement(iconNode, customAttrs = {}) {\n  if (typeof document === "undefined") throw new Error("createElement() only works in a browser environment.");\n  return createSvgElement(document, ["svg", { ...defaultAttributes, ...customAttrs }, iconNode]);\n}\nexport default createElement;\n`,
  );
  await writeFile(
    path.join(rawDist, "createElement.d.ts"),
    `import type { IconNode, SVGProps } from "./types.js";\nexport declare function createElement(iconNode: IconNode, customAttrs?: SVGProps): SVGElement;\nexport default createElement;\n`,
  );
  await writeFile(
    path.join(rawDist, "iconNodes.js"),
    `${rawImports}\n\nexport const icons = {\n${rawIconEntries}\n};\nexport default icons;\n`,
  );
  await writeFile(
    path.join(rawDist, "iconNodes.d.ts"),
    `import type { IconNode } from "./types.js";\nexport declare const icons: {\n${rawIconTypes}\n};\nexport default icons;\n`,
  );
  await writeFile(
    path.join(rawDist, "createIcons.js"),
    `import createElement from "./createElement.js";
import defaultAttributes from "./defaultAttributes.js";

function attributes(element) {
  return Object.fromEntries(Array.from(element.attributes, ({ name, value }) => [name, value]));
}
function classes(value) {
  if (Array.isArray(value)) return value;
  return typeof value === "string" ? value.split(/\\s+/).filter(Boolean) : [];
}
function hasAccessibleName(attrs) {
  return Object.keys(attrs).some((name) => name.startsWith("aria-") || name === "role" || name === "title");
}
function replaceElement(element, { nameAttr, icons, attrs }) {
  const name = element.getAttribute(nameAttr);
  if (!name) return;
  const componentName = name.split("-").filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join("");
  const iconNode = icons[componentName];
  if (!iconNode) {
    console.warn(\`\${element.outerHTML} icon name was not found in the provided icons object.\`);
    return;
  }
  const elementAttrs = attributes(element);
  const iconAttrs = { ...defaultAttributes, [nameAttr]: name, ...(hasAccessibleName(elementAttrs) ? {} : { "aria-hidden": "true" }), ...attrs, ...elementAttrs };
  iconAttrs.class = ["vadivam", \`vadivam-\${name}\`, ...classes(elementAttrs.class), ...classes(attrs.class)].filter((value, index, all) => value && all.indexOf(value) === index).join(" ");
  element.parentNode?.replaceChild(createElement(iconNode, iconAttrs), element);
}

export function createIcons({ icons = {}, nameAttr = "data-vadivam", attrs = {}, root = globalThis.document, inTemplates = false } = {}) {
  if (!Object.keys(icons).length) throw new Error("Please provide an icons object to createIcons().");
  if (!root) throw new Error("createIcons() only works in a browser environment.");
  if (!/^[A-Za-z_:][A-Za-z0-9_.:-]*$/.test(nameAttr)) throw new Error("createIcons() received an invalid nameAttr.");
  for (const element of root.querySelectorAll(\`[\${nameAttr}]\`)) replaceElement(element, { nameAttr, icons, attrs });
  if (inTemplates) {
    for (const template of root.querySelectorAll("template")) createIcons({ icons, nameAttr, attrs, root: template.content, inTemplates });
  }
}
export default createIcons;
`,
  );
  await writeFile(
    path.join(rawDist, "createIcons.d.ts"),
    `import type { Icons, SVGProps } from "./types.js";\nexport interface CreateIconsOptions {\n  icons?: Icons;\n  nameAttr?: string;\n  attrs?: SVGProps;\n  root?: Element | Document | DocumentFragment;\n  inTemplates?: boolean;\n}\nexport declare function createIcons(options?: CreateIconsOptions): void;\nexport default createIcons;\n`,
  );
  const manifest = JSON.stringify(icons, null, 2);
  await writeFile(
    path.join(rawDist, "manifest.js"),
    `export const icons = ${manifest};\nexport const iconNames = icons.map((icon) => icon.name);\nexport const iconsByName = Object.fromEntries(icons.map((icon) => [icon.name, icon]));\nexport default icons;\n`,
  );
  await writeFile(
    path.join(rawDist, "manifest.d.ts"),
    `import type { IconName, IconNode } from "./types.js";\nexport interface VadivamIconMetadata {\n  name: IconName;\n  componentName: string;\n  fileName: \`${"${IconName}"}.svg\`;\n  svgPath: \`icons/${"${IconName}"}.svg\`;\n  svg: string;\n  iconNode: IconNode;\n}\nexport declare const icons: readonly VadivamIconMetadata[];\nexport declare const iconNames: readonly IconName[];\nexport declare const iconsByName: Record<IconName, VadivamIconMetadata>;\nexport default icons;\n`,
  );
  await writeFile(
    path.join(rawDist, "index.js"),
    `export { createElement } from "./createElement.js";\nexport { createIcons } from "./createIcons.js";\nexport { icons } from "./iconNodes.js";\nexport { icons as manifest, iconNames, iconsByName } from "./manifest.js";\n${rawNamedExports}\n`,
  );
  await writeFile(
    path.join(rawDist, "index.d.ts"),
    `export { createElement } from "./createElement.js";\nexport { createIcons } from "./createIcons.js";\nexport { icons } from "./iconNodes.js";\nexport { icons as manifest, iconNames, iconsByName } from "./manifest.js";\n${rawNamedExports}\nexport type { CreateIconsOptions } from "./createIcons.js";\nexport type { VadivamIconMetadata } from "./manifest.js";\nexport type { IconName, IconNode, Icons, SVGProps } from "./types.js";\n`,
  );
}

async function buildReactPackage(icons) {
  await rm(reactDist, { recursive: true, force: true });
  await mkdir(path.join(reactDist, "icons"), { recursive: true });
  const iconNameType = icons.map((icon) => JSON.stringify(icon.name)).join(" | ");
  await writeFile(
    path.join(reactDist, "types.d.ts"),
    `import type * as React from "react";\nexport type SVGElementType = "circle" | "ellipse" | "g" | "line" | "path" | "polygon" | "polyline" | "rect";\nexport type IconNode = readonly [tag: SVGElementType, attrs: Record<string, string>][];\nexport type SVGAttributes = Partial<React.SVGProps<SVGSVGElement>>;\nexport interface VadivamProps extends Omit<React.SVGProps<SVGSVGElement>, "color"> {\n  size?: string | number;\n  color?: string;\n  strokeWidth?: string | number;\n  absoluteStrokeWidth?: boolean;\n  title?: string;\n}\nexport type VadivamIcon = React.ForwardRefExoticComponent<Omit<VadivamProps, "ref"> & React.RefAttributes<SVGSVGElement>>;\nexport type IconName = ${iconNameType};\n`,
  );
  await writeFile(
    path.join(reactDist, "defaultAttributes.js"),
    `const defaultAttributes = { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };\nexport default defaultAttributes;\n`,
  );
  await writeFile(
    path.join(reactDist, "context.js"),
    `"use client";\nimport React from "react";\n\nconst VadivamContext = React.createContext({});\nexport function VadivamProvider({ children, size, color, strokeWidth, absoluteStrokeWidth, className }) {\n  const value = React.useMemo(() => ({ size, color, strokeWidth, absoluteStrokeWidth, className }), [size, color, strokeWidth, absoluteStrokeWidth, className]);\n  return React.createElement(VadivamContext.Provider, { value }, children);\n}\nexport function useVadivamContext() {\n  return React.useContext(VadivamContext);\n}\n`,
  );
  await writeFile(
    path.join(reactDist, "context.d.ts"),
    `import type * as React from "react";\nimport type { VadivamProps } from "./types.js";\nexport interface VadivamProviderProps extends Pick<VadivamProps, "size" | "color" | "strokeWidth" | "absoluteStrokeWidth" | "className"> { children: React.ReactNode; }\nexport declare function VadivamProvider(props: VadivamProviderProps): React.ReactElement;\nexport declare function useVadivamContext(): Partial<VadivamProps>;\n`,
  );
  await writeFile(
    path.join(reactDist, "Icon.js"),
    `"use client";\nimport React, { forwardRef } from "react";\nimport defaultAttributes from "./defaultAttributes.js";\nimport { useVadivamContext } from "./context.js";\n\nfunction mergeClasses(...values) {\n  return values.flatMap((value) => typeof value === "string" ? value.split(/\\s+/) : []).filter((value, index, all) => value && all.indexOf(value) === index).join(" ");\n}\nfunction hasA11yProp(props) {\n  return Object.keys(props).some((name) => name.startsWith("aria-") || name === "role" || name === "title");\n}\nfunction renderNode([tag, attrs]) {\n  return React.createElement(tag, attrs);\n}\n\nexport const Icon = forwardRef(({ color, size, strokeWidth, absoluteStrokeWidth, className = "", title, children, iconNode, ...rest }, ref) => {\n  const context = useVadivamContext();\n  const resolvedSize = size ?? context.size ?? 24;\n  const resolvedStrokeWidth = strokeWidth ?? context.strokeWidth ?? 2;\n  const numericSize = Number(resolvedSize);\n  const useAbsoluteStrokeWidth = absoluteStrokeWidth ?? context.absoluteStrokeWidth ?? false;\n  const calculatedStrokeWidth = useAbsoluteStrokeWidth && Number.isFinite(numericSize) ? Number(resolvedStrokeWidth) * 24 / numericSize : resolvedStrokeWidth;\n  const labelled = Boolean(title) || hasA11yProp(rest);\n  return React.createElement(\n    "svg",\n    {\n      ref,\n      ...defaultAttributes,\n      width: resolvedSize,\n      height: resolvedSize,\n      stroke: color ?? context.color ?? "currentColor",\n      strokeWidth: calculatedStrokeWidth,\n      className: mergeClasses("vadivam", context.className, className),\n      ...(!children && !labelled ? { "aria-hidden": "true" } : {}),\n      ...(title ? { role: "img" } : {}),\n      ...rest\n    },\n    title ? React.createElement("title", { key: "title" }, title) : null,\n    ...iconNode.map(renderNode),\n    children\n  );\n});\nIcon.displayName = "Icon";\nexport default Icon;\n`,
  );
  await writeFile(
    path.join(reactDist, "Icon.d.ts"),
    `import type * as React from "react";\nimport type { IconNode, VadivamProps } from "./types.js";\nexport interface IconProps extends VadivamProps { iconNode: IconNode; }\nexport declare const Icon: React.ForwardRefExoticComponent<Omit<IconProps, "ref"> & React.RefAttributes<SVGSVGElement>>;\nexport default Icon;\n`,
  );
  await writeFile(
    path.join(reactDist, "createIcon.js"),
    `import React, { forwardRef } from "react";\nimport Icon from "./Icon.js";\n\nfunction toKebabCase(value) {\n  return value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[ _]+/g, "-").toLowerCase();\n}\nfunction toPascalCase(value) {\n  return value.split(/[-_ ]+/).filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join("");\n}\nexport function createIcon(iconName, iconNode) {\n  const Component = forwardRef(({ className, ...props }, ref) => React.createElement(Icon, { ref, iconNode, className: [\`vadivam-${"${toKebabCase(iconName)}"}\`, className].filter(Boolean).join(" "), ...props }));\n  Component.displayName = toPascalCase(iconName);\n  return Component;\n}\nexport const createVadivamIcon = createIcon;\n`,
  );
  await writeFile(
    path.join(reactDist, "createIcon.d.ts"),
    `import type { IconNode, VadivamIcon } from "./types.js";\nexport declare function createIcon(iconName: string, iconNode: IconNode): VadivamIcon;\nexport { createIcon as createVadivamIcon };\n`,
  );

  for (const icon of icons) {
    await writeFile(
      path.join(reactDist, "icons", `${icon.name}.js`),
      `import { createIcon } from "../createIcon.js";\nexport const __iconNode = ${JSON.stringify(icon.iconNode)};\nconst ${icon.componentName} = createIcon("${icon.name}", __iconNode);\nexport default ${icon.componentName};\n`,
    );
    await writeFile(
      path.join(reactDist, "icons", `${icon.name}.d.ts`),
      `import type { IconNode, VadivamIcon } from "../types.js";\nexport declare const __iconNode: IconNode;\n/** @component\n * @name ${icon.componentName}\n * @description Vadivam SVG icon component.\n * @see https://vadivam.praveenjuge.com/icons/${icon.name}\n */\ndeclare const ${icon.componentName}: VadivamIcon;\nexport default ${icon.componentName};\n`,
    );
  }

  const namedExports = icons
    .map(
      (icon) =>
        `export { default as ${icon.componentName}, default as ${icon.componentName}Icon, default as Vadivam${icon.componentName} } from "./icons/${icon.name}.js";`,
    )
    .join("\n");
  const dynamicEntries = icons
    .map((icon) => `  "${icon.name}": () => import("./icons/${icon.name}.js")`)
    .join(",\n");
  const dynamicTypes = icons
    .map(
      (icon) =>
        `  readonly "${icon.name}": () => Promise<DynamicIconModule>;`,
    )
    .join("\n");
  const reactImports = icons
    .map(
      (icon) =>
        `import ${icon.componentName} from "./icons/${icon.name}.js";`,
    )
    .join("\n");
  const reactIconEntries = icons
    .map((icon) => `  ${icon.componentName}`)
    .join(",\n");
  const reactIconTypes = icons
    .map((icon) => `  readonly ${icon.componentName}: VadivamIcon;`)
    .join("\n");
  await writeFile(
    path.join(reactDist, "icons.js"),
    `${reactImports}\n\nexport const icons = {\n${reactIconEntries}\n};\nexport default icons;\n`,
  );
  await writeFile(
    path.join(reactDist, "icons.d.ts"),
    `import type { VadivamIcon } from "./types.js";\nexport declare const icons: {\n${reactIconTypes}\n};\nexport default icons;\n`,
  );
  await writeFile(
    path.join(reactDist, "index.js"),
    `${namedExports}\nexport { Icon } from "./Icon.js";\nexport { createIcon, createVadivamIcon } from "./createIcon.js";\nexport { icons } from "./icons.js";\nexport { VadivamProvider, useVadivamContext } from "./context.js";\n`,
  );
  await writeFile(
    path.join(reactDist, "index.d.ts"),
    `${namedExports}\nexport { Icon } from "./Icon.js";\nexport { createIcon, createVadivamIcon } from "./createIcon.js";\nexport { icons } from "./icons.js";\nexport { VadivamProvider, useVadivamContext } from "./context.js";\nexport type { IconName, IconNode, SVGAttributes, VadivamIcon, VadivamProps } from "./types.js";\n`,
  );
  await writeFile(
    path.join(reactDist, "dynamicIconImports.js"),
    `const dynamicIconImports = {\n${dynamicEntries}\n};\nexport { dynamicIconImports };\nexport default dynamicIconImports;\n`,
  );
  await writeFile(
    path.join(reactDist, "dynamicIconImports.d.ts"),
    `import type { IconNode, VadivamIcon } from "./types.js";\nexport interface DynamicIconModule { default: VadivamIcon; __iconNode: IconNode; }\ndeclare const dynamicIconImports: {\n${dynamicTypes}\n};\nexport { dynamicIconImports };\nexport default dynamicIconImports;\n`,
  );
  await writeFile(
    path.join(reactDist, "dynamic.js"),
    `"use client";\nimport React, { forwardRef } from "react";\nimport dynamicIconImports from "./dynamicIconImports.js";\n\nexport const iconNames = Object.keys(dynamicIconImports);\nexport const DynamicIcon = forwardRef(({ name, fallback = null, ...props }, ref) => {\n  const importer = dynamicIconImports[name];\n  const Component = React.useMemo(() => importer ? React.lazy(importer) : null, [importer]);\n  if (!Component) return fallback;\n  return React.createElement(React.Suspense, { fallback }, React.createElement(Component, { ...props, ref }));\n});\nDynamicIcon.displayName = "DynamicIcon";\nexport { dynamicIconImports };\nexport default DynamicIcon;\n`,
  );
  await writeFile(
    path.join(reactDist, "dynamic.d.ts"),
    `import type * as React from "react";\nimport type { IconName, VadivamProps } from "./types.js";\nimport dynamicIconImports from "./dynamicIconImports.js";\nexport interface DynamicIconProps extends Omit<VadivamProps, "ref"> {\n  name: IconName;\n  fallback?: React.ReactNode;\n}\nexport declare const iconNames: IconName[];\nexport declare const DynamicIcon: React.ForwardRefExoticComponent<DynamicIconProps & React.RefAttributes<SVGSVGElement>>;\nexport { dynamicIconImports };\nexport type { DynamicIconModule } from "./dynamicIconImports.js";\nexport type { IconName } from "./types.js";\nexport default DynamicIcon;\n`,
  );
}

async function buildWebAssets(icons) {
  await rm(webIconsDir, { recursive: true, force: true });
  await mkdir(webIconsDir, { recursive: true });
  for (const icon of icons) {
    await copyFile(
      path.join(iconsDir, icon.fileName),
      path.join(webIconsDir, icon.fileName),
    );
  }
}

export async function buildPreview() {
  const icons = await readIcons();
  const rows = 8;
  const cell = 32;
  const padding = 32;
  const gap = 24;
  const scale = 2;
  const strokeWidth = 2.25;
  const columns = Math.max(1, Math.ceil(icons.length / rows));
  const width = padding * 2 + columns * cell + (columns - 1) * gap;
  const height = padding * 2 + rows * cell + (rows - 1) * gap;
  const tiles = icons
    .map((icon, i) => {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const x = padding + col * (cell + gap);
      const y = padding + row * (cell + gap);
      const inner = icon.svg
        .replace(/^[\s\S]*?<svg\b[^>]*>/, "")
        .replace(/<\/svg>\s*$/, "")
        .trim();
      return `<g transform="translate(${x} ${y}) scale(${cell / 24})">${inner}</g>`;
    })
    .join("");
  const composite = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" stroke="#000000" stroke-width="${(strokeWidth * 24) / cell}" stroke-linecap="round" stroke-linejoin="round"><rect width="${width}" height="${height}" fill="#ffffff" stroke="none"/>${tiles}</svg>`;
  const png = new Resvg(composite, {
    fitTo: { mode: "width", value: width * scale },
    background: "#ffffff",
  })
    .render()
    .asPng();
  await mkdir(path.dirname(previewPath), { recursive: true });
  await writeFile(previewPath, png);
  console.log(
    `Wrote ${path.relative(root, previewPath)} (${icons.length} icons, ${columns}x${rows}, ${width * scale}x${height * scale}).`,
  );
}


function fnv1aHash(value) {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < value.length; i++) {
    hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleUnique(items, random) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export async function buildOg() {
  const icons = await readIcons();
  if (icons.length === 0) throw new Error("buildOg: no icons available");

  const width = 1200;
  const height = 630;
  const targetIconSize = 40;
  const targetGap = 24;
  const targetStep = targetIconSize + targetGap;
  const angle = -22;

  const innerSvgs = icons.map((icon) =>
    icon.svg
      .replace(/^[\s\S]*?<svg\b[^>]*>/, "")
      .replace(/<\/svg>\s*$/, "")
      .trim(),
  );

  const seed = fnv1aHash(icons.map((icon) => icon.name).join(","));
  const random = mulberry32(seed);

  // Match the grid to the rotated canvas bounds so more unique icons remain
  // visible instead of being cropped out by an oversized square grid.
  const radians = (Math.abs(angle) * Math.PI) / 180;
  const coverWidth =
    Math.ceil(width * Math.cos(radians) + height * Math.sin(radians)) +
    targetStep * 2;
  const coverHeight =
    Math.ceil(width * Math.sin(radians) + height * Math.cos(radians)) +
    targetStep * 2;
  const aspect = coverWidth / coverHeight;
  const rows = Math.max(1, Math.ceil(Math.sqrt(icons.length / aspect)));
  const columns = Math.ceil(icons.length / rows);
  const stepX = coverWidth / columns;
  const stepY = coverHeight / rows;
  const iconSize = Math.min(stepX, stepY) * (targetIconSize / targetStep);
  const offsetX = -coverWidth / 2;
  const offsetY = -coverHeight / 2;
  const scale = iconSize / 24;
  const positions = Array.from({ length: rows * columns }, (_, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    return {
      index,
      x: offsetX + col * stepX,
      y: offsetY + row * stepY,
      distance: Math.hypot(
        col - (columns - 1) / 2,
        row - (rows - 1) / 2,
      ),
    };
  });
  const skippedPositions = new Set(
    [...positions]
      .sort((a, b) => b.distance - a.distance || b.index - a.index)
      .slice(0, positions.length - icons.length)
      .map((position) => position.index),
  );
  const visiblePositions = positions.filter(
    (position) => !skippedPositions.has(position.index),
  );
  const uniqueSvgs = shuffleUnique(innerSvgs, random);
  const tiles = visiblePositions.map(({ x, y }, index) =>
    `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(4)})">${uniqueSvgs[index]}</g>`,
  );

  const composite = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" stroke-linecap="round" stroke-linejoin="round">
<rect width="${width}" height="${height}" fill="#ffffff"/>
<g transform="translate(${width / 2} ${height / 2}) rotate(${angle})" stroke="#111111" stroke-width="1.5">${tiles.join("")}</g>
</svg>`;

  const png = new Resvg(composite, {
    fitTo: { mode: "width", value: width },
    background: "#ffffff",
  })
    .render()
    .asPng();
  await mkdir(path.dirname(ogPath), { recursive: true });
  await writeFile(ogPath, png);
  console.log(
    `Wrote ${path.relative(root, ogPath)} (${icons.length} unique icons, ${tiles.length} tiles, ${width}x${height}).`,
  );
}

export async function build() {
  const icons = await readIcons();
  await buildRawPackage(icons);
  await buildReactPackage(icons);
  await buildWebAssets(icons);
  console.log(`Built packages and web assets for ${icons.length} icons.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  if (command === "optimize") await optimizeIcons();
  else if (command === "check") await checkIcons();
  else if (command === "build") await build();
  else if (command === "preview") await buildPreview();
  else if (command === "og") await buildOg();
  else {
    console.error(
      "Usage: bun scripts/icons.mjs <optimize|check|build|preview|og>",
    );
    process.exit(1);
  }
}
