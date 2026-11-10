import path from "node:path";
import {
  buildStyles,
  defaultAttributesSource,
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

const indexExports = (icons) => [
  { icons },
  { from: "./Icon.js", values: ["Icon"] },
  { from: "./createVadivamIcon.js", values: ["createVadivamIcon"] },
  { from: "./icons.js", values: ["icons"] },
  { from: "./Icon.js", types: ["IconProps"] },
  { from: "./types.js", types: ["IconName", "IconNode", "SVGElementType", "VadivamIcon", "VadivamProps"] },
];

/** Every name the root entry exports besides the icons. */
export const apiExports = exportedNames(indexExports([]));

// Icons are Qwik inline components: plain functions that render during SSR and
// ship no client JavaScript, so they need no component$ boundary or QRLs.
export async function build({ iconsByStyle, directory }) {
  const dist = path.join(directory, "dist");
  await prepareDist(dist);
  await writeRuntimePolicy(dist);
  await buildStyles(dist, iconsByStyle, buildQwikEntry);
}

async function buildQwikEntry(dist, icons, style) {
  const shared = style.shared;
  // Solid icons take no stroke props, so they are dropped before the root attributes.
  const strokeProps = style.stroked ? `strokeWidth = ${defaultStrokeWidth}, absoluteStrokeWidth = false, ` : "strokeWidth: _strokeWidth, absoluteStrokeWidth: _absoluteStrokeWidth, ";
  const paint = objectEntries(paintBindings(style, { color: "sanitizePaint(color)", strokeWidth: "strokeWidth", size: "size", absolute: "absoluteStrokeWidth" }));
  // PublicProps lets callers pass plain functions to onClick$ and other $
  // props, which the Qwik optimizer turns into QRLs.
  await write(dist, "types.d.ts", `import type { FunctionComponent, PropsOf, PublicProps } from "@qwik.dev/core";\nexport type SVGElementType = ${svgElementTypeSource};\nexport type IconNode = readonly [tag: SVGElementType, attrs: Record<string, string | number | boolean>][];\nexport interface VadivamProps extends Omit<PropsOf<"svg">, "color" | "size"${style.stroked ? "" : ' | "stroke-width"'}> { size?: string | number; color?: string;${strokePropTypes(style)} title?: string; }\nexport type VadivamIcon = FunctionComponent<PublicProps<VadivamProps>>;\nexport type IconName = ${iconNameType(icons)};\n`);
  await write(dist, "defaultAttributes.js", `export default ${defaultAttributesSource(style)};\n`);
  await write(dist, "IconBase.js", `import { jsx } from "@qwik.dev/core";
import defaultAttributes from "./defaultAttributes.js";
import { sanitizePaint, sanitizeRootAttributes } from "${shared}runtimePolicy.js";

// Qwik event handlers (onClick$, window:onScroll$) are QRLs the optimizer
// creates, not inline strings, so they pass through; everything else goes
// through the shared root-attribute policy.
const QWIK_EVENT = /^(?:(?:document|window):)?on[A-Z][A-Za-z0-9]*\\$$/;
function rootAttributes(rest) {
  const events = {};
  const attrs = {};
  for (const name of Object.keys(rest)) (QWIK_EVENT.test(name) ? events : attrs)[name] = rest[name];
  return { ...sanitizeRootAttributes(attrs), ...events };
}
${isLabelledSource()}
${style.stroked ? `${scaledStrokeWidthSource()}\n` : ""}
// Renders nodes as given: built-in icons pass nodes checked when the package is
// built, and Icon passes caller nodes after sanitizing them.
export function IconBase({ color, size = ${defaultSize}, ${strokeProps}children, iconNode = [], name, title, class: className, ref, ...rest }) {
  const safeRest = rootAttributes(rest);
  const labelled = isLabelled(title, Object.keys(safeRest));
  return jsx("svg", {
    ...defaultAttributes,
    width: size,
    height: size,
    ${paint},
    // Qwik joins class lists itself, so callers keep string, array, and
    // object (conditional) forms.
    class: ["vadivam", name && "vadivam-" + name, className],
    // A signal or callback ref, passed straight to Qwik like on a plain <svg>.
    ...(ref ? { ref } : {}),
    ...(!labelled ? { "aria-hidden": "true" } : {}),
    ...(title ? { role: "img" } : {}),
    ...safeRest,
    children: [title ? jsx("title", { children: title }) : null, ...iconNode.map(([tag, attrs]) => jsx(tag, attrs)), children],
  });
}
`);
  await write(dist, "Icon.js", `import { IconBase } from "./IconBase.js";\nimport { sanitizeIconNode } from "${shared}runtimePolicy.js";\nexport function Icon({ iconNode, ...props }) { return IconBase({ ...props, iconNode: sanitizeIconNode(iconNode) }); }\nexport default Icon;\n`);
  await write(dist, "Icon.d.ts", `import type { IconNode, VadivamProps } from "./types.js";\nexport interface IconProps extends VadivamProps { iconNode: IconNode; name?: string; }\nexport declare function Icon(props: IconProps): import("@qwik.dev/core").JSXOutput;\nexport default Icon;\n`);
  await write(dist, "createVadivamIcon.js", `import { Icon } from "./Icon.js";\nexport function createVadivamIcon(name, iconNode) { return (props) => Icon({ ...props, name, iconNode }); }\nexport default createVadivamIcon;\n`);
  await write(dist, "createVadivamIcon.d.ts", `import type { IconNode, VadivamIcon } from "./types.js";\nexport declare function createVadivamIcon(name: string, iconNode: IconNode): VadivamIcon;\nexport default createVadivamIcon;\n`);
  for (const icon of icons) {
    await write(dist, `icons/${icon.name}.js`, `import { IconBase } from "../IconBase.js";\nexport const __iconNode = ${iconNode(icon)};\nexport default function ${icon.componentName}(props) { return IconBase({ ...props, name: "${icon.name}", iconNode: __iconNode }); }\n`);
    await write(dist, `icons/${icon.name}.d.ts`, `import type { IconNode, VadivamIcon } from "../types.js";\nexport declare const __iconNode: IconNode;\ndeclare const icon: VadivamIcon;\nexport default icon;\n`);
  }
  await write(dist, "icons.js", `${iconImports(icons)}\nexport const icons = {\n${iconRegistryEntries(icons)}\n};\nexport default icons;\n`);
  await write(dist, "icons.d.ts", `import type { VadivamIcon } from "./types.js";\nexport declare const icons: {\n${iconRegistryTypes(icons, "VadivamIcon")}\n};\nexport default icons;\n`);
  await write(dist, "icons/index.js", `${iconExports(icons, { prefix: "./" })}\n`);
  await write(dist, "icons/index.d.ts", `${iconExports(icons, { prefix: "./" })}\n`);
  await writeExports(dist, "index", indexExports(icons));
}
