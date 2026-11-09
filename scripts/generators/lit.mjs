import path from "node:path";
import {
  buildStyles,
  defaultSize,
  defaultStrokeWidth,
  dynamicEntries,
  dynamicTypes,
  exportedNames,
  iconExports,
  iconImports,
  iconNameType,
  iconRegistryEntries,
  iconRegistryTypes,
  mergeClassesSource,
  paintBindings,
  prepareDist,
  rootAttributeMarkup,
  scaledStrokeWidthSource,
  strokePropTypes,
  svgElementTypeSource,
  write,
  writeExports,
  writeRuntimePolicy,
} from "./shared.mjs";

const indexExports = (icons) => [
  { icons },
  { from: "./Icon.js", values: ["Icon"] },
  { from: "./createVadivamIcon.js", values: ["createVadivamIcon"] },
  { from: "./icons.js", values: ["icons"] },
  { from: "./dynamicIconImports.js", values: ["dynamicIconImports", "iconNames"] },
  { from: "./Icon.js", types: ["IconProps"] },
  { from: "./types.js", types: ["IconName", "IconNode", "SVGElementType", "VadivamIcon", "VadivamProps"] },
];

// Written by the dynamic.js and dynamic.d.ts templates below.
const dynamicExports = ["DynamicIcon", "DynamicIconProps", "dynamicIconImports", "iconNames"];

/** Every name the root and dynamic entries export besides the icons. */
export const apiExports = [...exportedNames(indexExports([])), ...dynamicExports];

function escapeAttribute(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// Built-in icons become static `svg` template literals, so Lit parses each icon
// once and never sees runtime data inside the geometry.
function iconMarkup(icon) {
  return icon.iconNode
    .map(([tag, attrs]) => {
      const attributes = Object.entries(attrs)
        .map(([name, value]) => `${name}="${escapeAttribute(value)}"`)
        .join(" ");
      return `<${tag} ${attributes}></${tag}>`;
    })
    .join("");
}

export async function buildLitPackage({ icons, solidIcons, directory }) {
  const dist = path.join(directory, "dist");
  await prepareDist(dist);
  await writeRuntimePolicy(dist);
  await buildStyles(dist, { outline: icons, solid: solidIcons }, buildLitEntry);
}

async function buildLitEntry(dist, icons, style) {
  const shared = style.shared;
  const strokeProps = style.stroked ? `strokeWidth = ${defaultStrokeWidth}, absoluteStrokeWidth = false, ` : "";
  const bindings = [
    ["width", "size"],
    ["height", "size"],
    ...paintBindings(style, { color: "sanitizePaint(color)", strokeWidth: "strokeWidth", size: "size", absolute: "absoluteStrokeWidth" }),
  ];
  const root = rootAttributeMarkup(style, bindings, { bind: (expression) => `\${${expression}}` });
  await write(dist, "types.d.ts", `import type { TemplateResult } from "lit";\nexport type SVGElementType = ${svgElementTypeSource};\nexport type IconNode = readonly [tag: SVGElementType, attrs: Record<string, string | number | boolean>][];\nexport interface VadivamProps { size?: string | number; color?: string;${strokePropTypes(style)} class?: string; label?: string; }\nexport type VadivamIcon = (props?: VadivamProps) => TemplateResult;\nexport type IconName = ${iconNameType(icons)};\n`);
  await write(dist, "IconBase.js", `import { html, nothing } from "lit";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { sanitizePaint } from "${shared}runtimePolicy.js";

// <title> is a raw-text element to Lit's parser, so it can't hold a binding;
// the label is escaped and rendered as static SVG markup instead.
function titleMarkup(label) {
  return unsafeSVG("<title>" + String(label).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</title>");
}

${mergeClassesSource()}
${style.stroked ? `${scaledStrokeWidthSource()}\n` : ""}
// Renders built-in icon content as given: it is a static template generated
// with the package. Icon passes caller nodes only after sanitizing them.
export function renderIcon(name, content, { size = ${defaultSize}, color, ${strokeProps}class: className, label } = {}) {
  return html\`<svg ${root} class=\${mergeClasses("vadivam", name && "vadivam-" + name, className)} role=\${label ? "img" : nothing} aria-label=\${label || nothing} aria-hidden=\${label ? nothing : "true"}>\${label ? titleMarkup(label) : nothing}\${content}</svg>\`;
}
`);
  await write(dist, "Icon.js", `import { svg } from "lit";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { renderIcon } from "./IconBase.js";
import { sanitizeIconNode } from "${shared}runtimePolicy.js";

function escapeAttribute(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// Custom icon nodes may come from runtime data. The sanitizer keeps only SVG
// geometry tags and safe attributes, and every value is escaped before Lit
// parses the markup.
export function Icon({ iconNode, name, ...props } = {}) {
  const markup = sanitizeIconNode(iconNode).map(([tag, attrs]) => \`<\${tag} \${Object.entries(attrs).filter(([attr]) => attr !== "key").map(([attr, value]) => \`\${attr}="\${escapeAttribute(value)}"\`).join(" ")}></\${tag}>\`).join("");
  return renderIcon(name, svg\`\${unsafeSVG(markup)}\`, props);
}
export default Icon;
`);
  await write(dist, "Icon.d.ts", `import type { TemplateResult } from "lit";\nimport type { IconNode, VadivamProps } from "./types.js";\nexport interface IconProps extends VadivamProps { iconNode: IconNode; name?: string; }\nexport declare function Icon(props: IconProps): TemplateResult;\nexport default Icon;\n`);
  await write(dist, "createVadivamIcon.js", `import { Icon } from "./Icon.js";\nexport function createVadivamIcon(name, iconNode) { return (props = {}) => Icon({ ...props, name, iconNode }); }\nexport default createVadivamIcon;\n`);
  await write(dist, "createVadivamIcon.d.ts", `import type { IconNode, VadivamIcon } from "./types.js";\nexport declare function createVadivamIcon(name: string, iconNode: IconNode): VadivamIcon;\nexport default createVadivamIcon;\n`);
  for (const icon of icons) {
    await write(dist, `icons/${icon.name}.js`, `import { svg } from "lit";\nimport { renderIcon } from "../IconBase.js";\nconst content = svg\`${iconMarkup(icon)}\`;\nexport default function ${icon.componentName}(props) { return renderIcon("${icon.name}", content, props); }\n`);
    await write(dist, `icons/${icon.name}.d.ts`, `import type { VadivamIcon } from "../types.js";\ndeclare const icon: VadivamIcon;\nexport default icon;\n`);
  }
  await write(dist, "icons.js", `${iconImports(icons)}\nexport const icons = {\n${iconRegistryEntries(icons)}\n};\nexport default icons;\n`);
  await write(dist, "icons.d.ts", `import type { VadivamIcon } from "./types.js";\nexport declare const icons: {\n${iconRegistryTypes(icons, "VadivamIcon")}\n};\nexport default icons;\n`);
  await write(dist, "icons/index.js", `${iconExports(icons, { prefix: "./" })}\n`);
  await write(dist, "icons/index.d.ts", `${iconExports(icons, { prefix: "./" })}\n`);
  await write(dist, "dynamicIconImports.js", `const dynamicIconImports = {\n${dynamicEntries(icons)}\n};\nexport const iconNames = Object.keys(dynamicIconImports);\nexport { dynamicIconImports };\nexport default dynamicIconImports;\n`);
  await write(dist, "dynamicIconImports.d.ts", `import type { VadivamIcon } from "./types.js";\nexport interface DynamicIconModule { default: VadivamIcon; }\ndeclare const dynamicIconImports: {\n${dynamicTypes(icons)}\n};\nexport declare const iconNames: readonly (keyof typeof dynamicIconImports)[];\nexport { dynamicIconImports };\nexport default dynamicIconImports;\n`);
  await write(dist, "dynamic.js", `import { until } from "lit/directives/until.js";
import { nothing } from "lit";
import dynamicIconImports, { iconNames } from "./dynamicIconImports.js";
// Loaded icons render synchronously, so later updates keep the same SVG
// instead of passing through the fallback again.
const loaded = new Map();
// Resolves a runtime icon name. Unknown names and failed loads render the fallback.
export function DynamicIcon({ name, fallback = nothing, ...props } = {}) {
  const importer = Object.prototype.hasOwnProperty.call(dynamicIconImports, name) ? dynamicIconImports[name] : undefined;
  if (!importer) return fallback;
  const icon = loaded.get(name);
  if (icon) return icon(props);
  return until(importer().then((module) => {
    loaded.set(name, module.default);
    return module.default(props);
  }, () => fallback), fallback);
}
export { dynamicIconImports, iconNames };
export default DynamicIcon;
`);
  await write(dist, "dynamic.d.ts", `import type { IconName, VadivamProps } from "./types.js";\nexport interface DynamicIconProps extends VadivamProps { name: IconName; fallback?: unknown; }\nexport declare function DynamicIcon(props: DynamicIconProps): unknown;\nexport { default as dynamicIconImports, iconNames } from "./dynamicIconImports.js";\nexport default DynamicIcon;\n`);
  await writeExports(dist, "index", indexExports(icons));
}
