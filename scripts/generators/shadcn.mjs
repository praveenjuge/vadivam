// shadcn/ui registry: one self-contained React component per icon, served
// flat at /r/<name>.json with a /r/registry.json index. Solid icons are a
// second registry at /r/solid/, installed under components/icons/solid/.
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { styleOf } from "../icon-styles.mjs";
import { shadcnItemUrl, siteUrl } from "../snippets.mjs";
import {
  defaultSize,
  defaultStrokeWidth,
  isLabelledSource,
  mergeClassesSource,
  paintBindings,
  rootAttributeMarkup,
  scaledStrokeWidthSource,
} from "./shared.mjs";

export const baseItemName = "vadivam-icon";
const registryName = "vadivam";
const author = `Praveen Juge <${siteUrl}>`;
const itemSchema = "https://ui.shadcn.com/schema/registry-item.json";
const registrySchema = "https://ui.shadcn.com/schema/registry.json";

// The base component every icon item renders through, following the render
// contract in shared.mjs.
function baseComponentSource(style) {
  const bindings = [
    ["width", "size"],
    ["height", "size"],
    ...paintBindings(style, { color: "color", strokeWidth: "strokeWidth", size: "size", absolute: "absoluteStrokeWidth" }),
  ];
  const helpers = [mergeClassesSource, isLabelledSource, ...(style.stroked ? [scaledStrokeWidthSource] : [])]
    .map((source) => `${source({ typeScript: true })}\n`)
    .join("");
  return `import type * as React from "react";

export type VadivamIconProps = ${style.stroked ? `React.ComponentProps<"svg">` : `Omit<React.ComponentProps<"svg">, "strokeWidth">`} & {
  size?: number | string;
  color?: string;
${style.stroked ? "  strokeWidth?: number | string;\n  absoluteStrokeWidth?: boolean;\n" : ""}  title?: string;
};

${helpers}
export function VadivamIcon({
  name,
  size = ${defaultSize},
  color = "currentColor",
${style.stroked ? `  strokeWidth = ${defaultStrokeWidth},\n  absoluteStrokeWidth = false,\n` : ""}  title,
  className,
  children,
  ...props
}: VadivamIconProps & { name: string }) {
  const labelled = isLabelled(title, Object.keys(props));
  return (
    <svg
      ${rootAttributeMarkup(style, bindings, { camel: true, separator: "\n      " })}
      className={mergeClasses("vadivam", \`vadivam-\${name}\`, className)}
      aria-hidden={labelled ? undefined : true}
      role={title ? "img" : undefined}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}
`;
}

function jsxElement([tag, attrs]) {
  const props = Object.entries(attrs)
    .map(([name, value]) => {
      const text = String(value);
      if (!/^[a-z][a-zA-Z0-9]*$/.test(name) || /["{}<>\\]/.test(text)) {
        throw new Error(`Unsafe ${tag} attribute for the shadcn registry: ${name}`);
      }
      return ` ${name}="${text}"`;
    })
    .join("");
  return `<${tag}${props} />`;
}

function iconComponentSource(icon) {
  const { componentName, name } = icon;
  const children = icon.iconNode.map((node) => `      ${jsxElement(node)}`).join("\n");
  return `import { VadivamIcon, type VadivamIconProps } from "./${baseItemName}";

export function ${componentName}(props: VadivamIconProps) {
  return (
    <VadivamIcon name="${name}" {...props}>
${children}
    </VadivamIcon>
  );
}

export { ${componentName} as ${componentName}Icon };
export default ${componentName};
`;
}

// A style's items install into its own folder, as its package entry does.
function componentFile(name, content, style) {
  const folder = ["icons", style.entryDirectory].filter(Boolean).join("/");
  return {
    path: `registry/${folder}/${name}.tsx`,
    content,
    type: "registry:component",
    target: `@components/${folder}/${name}.tsx`,
  };
}

function baseItem(style) {
  return {
    $schema: itemSchema,
    name: baseItemName,
    type: "registry:component",
    title: "VadivamIcon",
    description: style.stroked
      ? "Shared base component for Vadivam icons: size, color, strokeWidth, absoluteStrokeWidth, and title props on a 24px outline SVG."
      : `Shared base component for ${style.id} Vadivam icons: size, color, and title props on a 24px filled SVG.`,
    author,
    docs: `Props and usage: ${siteUrl}/docs/shadcn`,
    files: [componentFile(baseItemName, baseComponentSource(style), style)],
  };
}

export function iconItem(icon, { baseUrl = siteUrl, style = "outline" } = {}) {
  const tags = icon.tags.length ? ` Tags: ${icon.tags.join(", ")}.` : "";
  return {
    $schema: itemSchema,
    name: icon.name,
    type: "registry:component",
    title: icon.componentName,
    description: `${icon.componentName} icon from Vadivam, a 24px ${style} icon set.${tags}`,
    author,
    registryDependencies: [shadcnItemUrl(baseItemName, baseUrl, style)],
    files: [componentFile(icon.name, iconComponentSource(icon), styleOf(style))],
    categories: icon.categories,
    meta: { tags: icon.tags, lucide: icon.name },
    docs: `Preview and other formats: ${siteUrl}/icons/${icon.name}`,
  };
}

export function registryItems(icons, options = {}) {
  for (const icon of icons) {
    if (icon.name === baseItemName || icon.name === "registry") {
      throw new Error(`Icon name collides with a shadcn registry file: ${icon.name}`);
    }
  }
  return [baseItem(styleOf(options.style)), ...icons.map((icon) => iconItem(icon, options))];
}

/** The registry index lists every item; per the directory rules its files carry no content. */
function registryIndex(items, style) {
  return {
    $schema: registrySchema,
    name: [registryName, style.entryDirectory].filter(Boolean).join("-"),
    homepage: siteUrl,
    items: items.map(({ $schema, files, ...item }) => ({
      ...item,
      files: files.map(({ content, ...file }) => file),
    })),
  };
}

export async function buildShadcnRegistry(icons, outDir, options = {}) {
  const items = registryItems(icons, options);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await writeFile(
    path.join(outDir, "registry.json"),
    `${JSON.stringify(registryIndex(items, styleOf(options.style)))}\n`,
  );
  for (const item of items) {
    await writeFile(
      path.join(outDir, `${item.name}.json`),
      `${JSON.stringify(item, null, 2)}\n`,
    );
  }
  if (options.solidIcons?.length) {
    const { solidIcons, ...rest } = options;
    const solid = styleOf("solid");
    await buildShadcnRegistry(solidIcons, path.join(outDir, solid.entryDirectory), { ...rest, style: solid.id });
  }
  return items;
}
