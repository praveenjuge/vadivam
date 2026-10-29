import {
  iconExports,
  iconImports,
  iconNameType,
  iconNode,
  iconRegistryEntries,
  iconRegistryTypes,
  prepareDist,
  svgElementTypeSource,
  write,
  writeRuntimePolicy,
} from "./shared.mjs";

// Icons are Qwik inline components: plain functions that render during SSR and
// ship no client JavaScript, so they need no component$ boundary or QRLs.
export async function buildQwikPackage(icons, dist) {
  await prepareDist(dist);
  await writeRuntimePolicy(dist);
  // PublicProps lets callers pass plain functions to onClick$ and other $
  // props, which the Qwik optimizer turns into QRLs.
  await write(dist, "types.d.ts", `import type { FunctionComponent, PropsOf, PublicProps } from "@qwik.dev/core";\nexport type SVGElementType = ${svgElementTypeSource};\nexport type IconNode = readonly [tag: SVGElementType, attrs: Record<string, string | number | boolean>][];\nexport interface VadivamProps extends Omit<PropsOf<"svg">, "color" | "size"> { size?: string | number; color?: string; strokeWidth?: string | number; absoluteStrokeWidth?: boolean; title?: string; }\nexport type VadivamIcon = FunctionComponent<PublicProps<VadivamProps>>;\nexport type IconName = ${iconNameType(icons)};\n`);
  await write(dist, "defaultAttributes.js", `export default { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" };\n`);
  await write(dist, "IconBase.js", `import { jsx } from "@qwik.dev/core";
import defaultAttributes from "./defaultAttributes.js";
import { sanitizePaint, sanitizeRootAttributes } from "./runtimePolicy.js";

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
function classes(...values) { return values.flatMap((value) => typeof value === "string" ? value.split(/\\s+/) : []).filter((value, index, all) => value && all.indexOf(value) === index).join(" "); }
function hasA11y(props) { return Object.keys(props).some((name) => name.startsWith("aria-") || name === "role"); }

// Renders nodes as given: built-in icons pass nodes checked when the package is
// built, and Icon passes caller nodes after sanitizing them.
export function IconBase({ color, size = 24, strokeWidth = 2, absoluteStrokeWidth = false, children, iconNode = [], name, title, class: className, ...rest }) {
  const numericSize = Number(size);
  const numericStroke = Number(strokeWidth);
  const stroke = absoluteStrokeWidth && Number.isFinite(numericSize) && numericSize !== 0 && Number.isFinite(numericStroke) ? numericStroke * 24 / numericSize : strokeWidth;
  const safeRest = rootAttributes(rest);
  const labelled = Boolean(title) || hasA11y(safeRest);
  return jsx("svg", {
    ...defaultAttributes,
    width: size,
    height: size,
    stroke: sanitizePaint(color),
    "stroke-width": stroke,
    class: classes("vadivam", name && "vadivam-" + name, typeof className === "string" ? className : undefined),
    ...(!labelled ? { "aria-hidden": "true" } : {}),
    ...(title ? { role: "img" } : {}),
    ...safeRest,
    children: [title ? jsx("title", { children: title }) : null, ...iconNode.map(([tag, attrs]) => jsx(tag, attrs)), children],
  });
}
`);
  await write(dist, "Icon.js", `import { IconBase } from "./IconBase.js";\nimport { sanitizeIconNode } from "./runtimePolicy.js";\nexport function Icon({ iconNode, ...props }) { return IconBase({ ...props, iconNode: sanitizeIconNode(iconNode) }); }\nexport default Icon;\n`);
  await write(dist, "Icon.d.ts", `import type { IconNode, VadivamProps } from "./types.js";\nexport interface IconProps extends VadivamProps { iconNode: IconNode; name?: string; }\nexport declare function Icon(props: IconProps): import("@qwik.dev/core").JSXOutput;\nexport default Icon;\n`);
  await write(dist, "createVadivamIcon.js", `import { Icon } from "./Icon.js";\nexport function createVadivamIcon(name, iconNode) { return (props) => Icon({ ...props, name, iconNode }); }\nexport default createVadivamIcon;\n`);
  await write(dist, "createVadivamIcon.d.ts", `import type { IconNode, VadivamIcon } from "./types.js";\nexport declare function createVadivamIcon(name: string, iconNode: IconNode): VadivamIcon;\nexport default createVadivamIcon;\n`);
  for (const icon of icons) {
    await write(dist, `icons/${icon.name}.js`, `import { IconBase } from "../IconBase.js";\nexport const __iconNode = ${iconNode(icon)};\nexport default function ${icon.componentName}(props) { return IconBase({ ...props, name: "${icon.name}", iconNode: __iconNode }); }\n`);
    await write(dist, `icons/${icon.name}.d.ts`, `import type { IconNode, VadivamIcon } from "../types.js";\nexport declare const __iconNode: IconNode;\ndeclare const icon: VadivamIcon;\nexport default icon;\n`);
  }
  await write(dist, "icons.js", `${iconImports(icons)}\nexport const icons = {\n${iconRegistryEntries(icons)}\n};\nexport default icons;\n`);
  await write(dist, "icons.d.ts", `import type { VadivamIcon } from "./types.js";\nexport declare const icons: {\n${iconRegistryTypes(icons, "VadivamIcon")}\n};\nexport default icons;\n`);
  await write(dist, "icons/index.js", `${iconExports(icons, "./")}\n`);
  await write(dist, "icons/index.d.ts", `${iconExports(icons, "./")}\n`);
  const exports = iconExports(icons);
  await write(dist, "index.js", `${exports}\nexport { Icon } from "./Icon.js";\nexport { createVadivamIcon } from "./createVadivamIcon.js";\nexport { icons } from "./icons.js";\n`);
  await write(dist, "index.d.ts", `${exports}\nexport { Icon } from "./Icon.js";\nexport { createVadivamIcon } from "./createVadivamIcon.js";\nexport { icons } from "./icons.js";\nexport type { IconProps } from "./Icon.js";\nexport type { IconName, IconNode, SVGElementType, VadivamIcon, VadivamProps } from "./types.js";\n`);
}
