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
    await copyFile(
      path.join(iconsDir, icon.fileName),
      path.join(rawDist, "icons", icon.fileName),
    );
  }
  const manifest = JSON.stringify(icons, null, 2);
  await writeFile(
    path.join(rawDist, "manifest.js"),
    `export const icons = ${manifest};\nexport const iconNames = icons.map((icon) => icon.name);\nexport const iconsByName = Object.fromEntries(icons.map((icon) => [icon.name, icon]));\nexport default icons;\n`,
  );
  await writeFile(
    path.join(rawDist, "manifest.d.ts"),
    `export type IconNode = readonly [tag: string, attrs: Record<string, string>][];\nexport interface VadivamIconMetadata {\n  name: string;\n  componentName: string;\n  fileName: string;\n  svgPath: string;\n  svg: string;\n  iconNode: IconNode;\n}\nexport declare const icons: readonly VadivamIconMetadata[];\nexport declare const iconNames: readonly string[];\nexport declare const iconsByName: Record<string, VadivamIconMetadata>;\nexport default icons;\n`,
  );
  await writeFile(
    path.join(rawDist, "index.js"),
    `export { icons, iconNames, iconsByName } from "./manifest.js";\n`,
  );
  await writeFile(
    path.join(rawDist, "index.d.ts"),
    `export { icons, iconNames, iconsByName } from "./manifest.js";\nexport type { IconNode, VadivamIconMetadata } from "./manifest.js";\n`,
  );
}

async function buildReactPackage(icons) {
  await rm(reactDist, { recursive: true, force: true });
  await mkdir(path.join(reactDist, "icons"), { recursive: true });
  await writeFile(
    path.join(reactDist, "types.d.ts"),
    `import type * as React from "react";\nexport type IconNode = readonly [tag: string, attrs: Record<string, string>][];\nexport interface VadivamProps extends Omit<React.SVGProps<SVGSVGElement>, "color"> {\n  size?: string | number;\n  color?: string;\n  strokeWidth?: string | number;\n  absoluteStrokeWidth?: boolean;\n  title?: string;\n}\nexport type VadivamIcon = React.ForwardRefExoticComponent<Omit<VadivamProps, "ref"> & React.RefAttributes<SVGSVGElement>>;\n`,
  );
  await writeFile(
    path.join(reactDist, "createIcon.js"),
    `import React, { forwardRef } from "react";\n\nfunction renderNode([tag, attrs]) {\n  return React.createElement(tag, attrs);\n}\n\nexport function createIcon(displayName, iconNode) {\n  const Icon = forwardRef(({ color = "currentColor", size = 24, strokeWidth = 2, absoluteStrokeWidth = false, title, children, ...rest }, ref) => {\n    const numericSize = Number(size);\n    const calculatedStrokeWidth = absoluteStrokeWidth && Number.isFinite(numericSize) ? Number(strokeWidth) * 24 / numericSize : strokeWidth;\n    const labelled = title || rest["aria-label"] || rest["aria-labelledby"];\n    return React.createElement(\n      "svg",\n      {\n        ref,\n        xmlns: "http://www.w3.org/2000/svg",\n        width: size,\n        height: size,\n        viewBox: "0 0 24 24",\n        fill: "none",\n        stroke: color,\n        strokeWidth: calculatedStrokeWidth,\n        strokeLinecap: "round",\n        strokeLinejoin: "round",\n        "aria-hidden": labelled ? undefined : "true",\n        role: labelled ? "img" : undefined,\n        ...rest\n      },\n      title ? React.createElement("title", { key: "title" }, title) : null,\n      ...iconNode.map(renderNode),\n      children\n    );\n  });\n  Icon.displayName = displayName;\n  return Icon;\n}\n`,
  );
  await writeFile(
    path.join(reactDist, "createIcon.d.ts"),
    `import type { IconNode, VadivamIcon } from "./types.js";\nexport declare function createIcon(displayName: string, iconNode: IconNode): VadivamIcon;\n`,
  );

  for (const icon of icons) {
    await writeFile(
      path.join(reactDist, "icons", `${icon.name}.js`),
      `import { createIcon } from "../createIcon.js";\nconst ${icon.componentName} = createIcon("${icon.componentName}", ${JSON.stringify(icon.iconNode)});\nexport default ${icon.componentName};\n`,
    );
    await writeFile(
      path.join(reactDist, "icons", `${icon.name}.d.ts`),
      `import type { VadivamIcon } from "../types.js";\ndeclare const ${icon.componentName}: VadivamIcon;\nexport default ${icon.componentName};\n`,
    );
  }

  const namedExports = icons
    .map(
      (icon) =>
        `export { default as ${icon.componentName} } from "./icons/${icon.name}.js";`,
    )
    .join("\n");
  const dynamicEntries = icons
    .map((icon) => `  "${icon.name}": () => import("./icons/${icon.name}.js")`)
    .join(",\n");
  const dynamicTypes = icons
    .map(
      (icon) =>
        `  readonly "${icon.name}": () => Promise<{ default: VadivamIcon }>;`,
    )
    .join("\n");
  await writeFile(
    path.join(reactDist, "index.js"),
    `${namedExports}\nexport { createIcon } from "./createIcon.js";\nexport { DynamicIcon } from "./dynamic.js";\nexport { default as dynamicIconImports } from "./dynamicIconImports.js";\n`,
  );
  await writeFile(
    path.join(reactDist, "index.d.ts"),
    `${namedExports}\nexport { createIcon } from "./createIcon.js";\nexport { DynamicIcon } from "./dynamic.js";\nexport { default as dynamicIconImports } from "./dynamicIconImports.js";\nexport type { IconNode, VadivamIcon, VadivamProps } from "./types.js";\n`,
  );
  await writeFile(
    path.join(reactDist, "dynamicIconImports.js"),
    `const dynamicIconImports = {\n${dynamicEntries}\n};\nexport { dynamicIconImports };\nexport default dynamicIconImports;\n`,
  );
  await writeFile(
    path.join(reactDist, "dynamicIconImports.d.ts"),
    `import type { VadivamIcon } from "./types.js";\ndeclare const dynamicIconImports: {\n${dynamicTypes}\n};\nexport { dynamicIconImports };\nexport default dynamicIconImports;\n`,
  );
  await writeFile(
    path.join(reactDist, "dynamic.js"),
    `import React from "react";\nimport dynamicIconImports from "./dynamicIconImports.js";\n\nexport function DynamicIcon({ name, fallback = null, ...props }) {\n  const importer = dynamicIconImports[name];\n  if (!importer) return fallback;\n  const Icon = React.useMemo(() => React.lazy(importer), [importer]);\n  return React.createElement(React.Suspense, { fallback }, React.createElement(Icon, props));\n}\n\nexport default DynamicIcon;\n`,
  );
  await writeFile(
    path.join(reactDist, "dynamic.d.ts"),
    `import type * as React from "react";\nimport type { VadivamProps } from "./types.js";\nimport type dynamicIconImports from "./dynamicIconImports.js";\nexport type IconName = keyof typeof dynamicIconImports;\nexport interface DynamicIconProps extends Omit<VadivamProps, "ref"> {\n  name: IconName;\n  fallback?: React.ReactNode;\n}\nexport declare function DynamicIcon(props: DynamicIconProps): React.ReactElement | null;\nexport default DynamicIcon;\n`,
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
  const columns = 16;
  const cell = 32;
  const padding = 32;
  const gap = 24;
  const scale = 2;
  const rows = Math.ceil(icons.length / columns);
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
  const composite = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" stroke="#000000" stroke-width="${(2 * 24) / cell}" stroke-linecap="round" stroke-linejoin="round"><rect width="${width}" height="${height}" fill="#ffffff" stroke="none"/>${tiles}</svg>`;
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
  else {
    console.error(
      "Usage: bun scripts/icons.mjs <optimize|check|build|preview>",
    );
    process.exit(1);
  }
}
