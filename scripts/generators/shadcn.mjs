// shadcn/ui registry: one self-contained React component per icon, served
// flat at /r/<name>.json with a /r/registry.json index.
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { shadcnItemUrl, siteUrl } from "../snippets.mjs";

export const registryName = "vadivam";
export const baseItemName = "vadivam-icon";
const author = `Praveen Juge <${siteUrl}>`;
const itemSchema = "https://ui.shadcn.com/schema/registry-item.json";
const registrySchema = "https://ui.shadcn.com/schema/registry.json";

export const baseComponentSource = `import type * as React from "react";

export type VadivamIconProps = React.ComponentProps<"svg"> & {
  size?: number | string;
  color?: string;
  strokeWidth?: number | string;
  absoluteStrokeWidth?: boolean;
  title?: string;
};

export function VadivamIcon({
  name,
  size = 24,
  color = "currentColor",
  strokeWidth = 2,
  absoluteStrokeWidth = false,
  title,
  className,
  children,
  ...props
}: VadivamIconProps & { name: string }) {
  const numericSize = Number(size);
  const stroke =
    absoluteStrokeWidth && numericSize > 0
      ? (Number(strokeWidth) * 24) / numericSize
      : strokeWidth;
  const labelled =
    Boolean(title) ||
    Object.keys(props).some((key) => key.startsWith("aria-") || key === "role");
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={["vadivam", \`vadivam-\${name}\`, className].filter(Boolean).join(" ")}
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

function jsxElement([tag, attrs]) {
  const props = Object.entries(attrs)
    .filter(([name]) => name !== "key")
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

export function iconComponentSource(icon) {
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

function componentFile(name, content) {
  return {
    path: `registry/icons/${name}.tsx`,
    content,
    type: "registry:component",
    target: `@components/icons/${name}.tsx`,
  };
}

export function baseItem() {
  return {
    $schema: itemSchema,
    name: baseItemName,
    type: "registry:component",
    title: "VadivamIcon",
    description:
      "Shared base component for Vadivam icons: size, color, strokeWidth, absoluteStrokeWidth, and title props on a 24px outline SVG.",
    author,
    docs: `Props and usage: ${siteUrl}/docs/shadcn`,
    files: [componentFile(baseItemName, baseComponentSource)],
  };
}

export function iconItem(icon, { baseUrl = siteUrl } = {}) {
  const tags = icon.tags.length ? ` Tags: ${icon.tags.join(", ")}.` : "";
  return {
    $schema: itemSchema,
    name: icon.name,
    type: "registry:component",
    title: icon.componentName,
    description: `${icon.componentName} icon from Vadivam, a 24px outline icon set.${tags}`,
    author,
    registryDependencies: [shadcnItemUrl(baseItemName, baseUrl)],
    files: [componentFile(icon.name, iconComponentSource(icon))],
    categories: icon.categories,
    meta: { tags: icon.tags, lucide: icon.name },
    docs: `Preview and other formats: ${siteUrl}/icons/${icon.name}`,
  };
}

export function registryItems(icons, options) {
  for (const icon of icons) {
    if (icon.name === baseItemName || icon.name === "registry") {
      throw new Error(`Icon name collides with a shadcn registry file: ${icon.name}`);
    }
  }
  return [baseItem(), ...icons.map((icon) => iconItem(icon, options))];
}

/** The registry index lists every item; per the directory rules its files carry no content. */
export function registryIndex(items) {
  return {
    $schema: registrySchema,
    name: registryName,
    homepage: siteUrl,
    items: items.map(({ $schema, files, ...item }) => ({
      ...item,
      files: files.map(({ content, ...file }) => file),
    })),
  };
}

export async function buildShadcnRegistry(icons, outDir, options) {
  const items = registryItems(icons, options);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await writeFile(
    path.join(outDir, "registry.json"),
    `${JSON.stringify(registryIndex(items))}\n`,
  );
  for (const item of items) {
    await writeFile(
      path.join(outDir, `${item.name}.json`),
      `${JSON.stringify(item, null, 2)}\n`,
    );
  }
  return items;
}
