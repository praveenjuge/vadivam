// Copy formats shared by the docs site, the shadcn registry, and the MCP
// server, which ships this file with packages.mjs and icon-styles.mjs.
// Browser-safe: imports only browser-safe modules.
import { attributeString, canvasSize, styleIds, styleOf, styles } from "./icon-styles.mjs";
import { frameworks, siteUrl, targetsById } from "./packages.mjs";

export { frameworks, siteUrl };

export const iconDefaults = Object.freeze({
  size: canvasSize,
  strokeWidth: styles.outline.paint["stroke-width"],
  color: styles.outline.paint.stroke,
  absoluteStrokeWidth: false,
});

export const frameworksById = Object.freeze(
  Object.fromEntries(frameworks.map((framework) => [framework.id, framework])),
);

// Every icon is drawn in each of these styles. Solid icons are filled, so they
// take no stroke options.
export const iconStyles = styleIds;

const isSolid = (options) => options?.style === "solid";

/** Resolve options against the defaults, keeping only finite numbers and plain colors. */
export function resolveOptions(options = {}) {
  const size = Number(options.size);
  const strokeWidth = Number(options.strokeWidth);
  const color = typeof options.color === "string" && /^[#\w(),.%\s-]{1,64}$/.test(options.color.trim())
    ? options.color.trim()
    : iconDefaults.color;
  return {
    size: Number.isFinite(size) && size > 0 ? size : iconDefaults.size,
    strokeWidth: Number.isFinite(strokeWidth) && strokeWidth > 0 ? strokeWidth : iconDefaults.strokeWidth,
    color,
    absoluteStrokeWidth: options.absoluteStrokeWidth === true,
  };
}

/** The stroke width written into the SVG, matching the components' `absoluteStrokeWidth` math. */
export function effectiveStrokeWidth(options = {}) {
  const { size, strokeWidth, absoluteStrokeWidth } = resolveOptions(options);
  const value = absoluteStrokeWidth ? (strokeWidth * canvasSize) / size : strokeWidth;
  return Number(value.toFixed(3));
}

/**
 * The command that adds a package, with its peers, such as `core` or a
 * framework id. npm packages honor `manager`.
 * @param {string} targetId
 * @param {{ manager?: string, version?: string }} [options]
 */
export function installCommand(targetId, { manager = "npm", version } = {}) {
  const target = targetsById[targetId];
  if (!target) throw new Error(`Unknown package: ${targetId}`);
  if (target.registry === "pub") return `flutter pub add ${target.packageName}`;
  if (target.registry === "maven") return `implementation("${target.packageName}:${version ?? "<version>"}")`;
  return `${manager} ${manager === "npm" ? "install" : "add"} ${[target.packageName, ...(target.peers ?? [])].join(" ")}`;
}

/** Flutter's generated icons use lowerCamelCase names, such as `arrowRight`. */
export function dartIconName(componentName) {
  return componentName[0].toLowerCase() + componentName.slice(1);
}

// Native color literals accept hex colors only; other CSS colors are left out.
function argbHex(color) {
  const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (!hex) return null;
  const full = hex.length === 3 ? [...hex].map((char) => char + char).join("") : hex;
  return `0xFF${full.toUpperCase()}`;
}

function changedProps(options) {
  const resolved = resolveOptions(options);
  const props = [];
  if (resolved.size !== iconDefaults.size) props.push(["size", resolved.size]);
  if (resolved.color !== iconDefaults.color) props.push(["color", resolved.color]);
  if (isSolid(options)) return props;
  if (resolved.strokeWidth !== iconDefaults.strokeWidth) props.push(["strokeWidth", resolved.strokeWidth]);
  if (resolved.absoluteStrokeWidth) props.push(["absoluteStrokeWidth", true]);
  return props;
}

const kebab = (name) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** The non-default props in one framework's attribute syntax, e.g. ` size={32}`. */
export function propsSource(frameworkId, options) {
  const props = changedProps(options);
  if (frameworkId === "flutter") {
    return props
      .map(([name, value]) => name === "color" ? (argbHex(value) ? `, color: Color(${argbHex(value)})` : "") : `, ${name}: ${value}`)
      .join("");
  }
  if (frameworkId === "compose") {
    const { size, strokeWidth, absoluteStrokeWidth } = resolveOptions(options);
    const named = Object.fromEntries(props);
    let source = "";
    if (!isSolid(options) && (named.strokeWidth !== undefined || absoluteStrokeWidth)) {
      source += `.withStrokeWidth(${strokeWidth}f${absoluteStrokeWidth ? `, absoluteSize = ${size}.dp` : ""})`;
    }
    source += ",\n    contentDescription = null";
    if (named.size !== undefined) source += `,\n    modifier = Modifier.size(${named.size}.dp)`;
    if (named.color !== undefined && argbHex(named.color)) source += `,\n    tint = Color(${argbHex(named.color)})`;
    return source;
  }
  if (frameworkId === "lit") {
    return props.length ? `{ ${props.map(([name, value]) => `${name}: ${typeof value === "string" ? JSON.stringify(value) : value}`).join(", ")} }` : "";
  }
  return props
    .map(([name, value]) => {
      if (frameworkId === "vue") {
        // The generated Vue components declare plain props, so a bare
        // attribute would arrive as "" rather than true.
        if (value === true) return `:${kebab(name)}="true"`;
        return typeof value === "number" ? `:${kebab(name)}="${value}"` : `${kebab(name)}="${value}"`;
      }
      if (frameworkId === "angular") {
        if (value === true) return `[${name}]="true"`;
        return typeof value === "number" ? `[${name}]="${value}"` : `${name}="${value}"`;
      }
      if (value === true) return name;
      return typeof value === "number" ? `${name}={${value}}` : `${name}="${value}"`;
    })
    .map((prop) => ` ${prop}`)
    .join("");
}

/** Import-and-render source for one framework and style, given its props source. */
export function componentSource(frameworkId, componentName, props, style = "outline") {
  const framework = frameworksById[frameworkId];
  if (!framework) throw new Error(`Unknown framework: ${frameworkId}`);
  const solid = style === "solid";
  const from = solid ? `${framework.packageName}/solid` : framework.packageName;
  switch (frameworkId) {
    case "vue":
      return `<script setup>\nimport { ${componentName} } from "${from}";\n</script>\n\n<template>\n  <${componentName}${props} />\n</template>`;
    case "svelte":
      return `<script>\n  import { ${componentName} } from "${from}";\n</script>\n\n<${componentName}${props} />`;
    case "astro":
      return `---\nimport { ${componentName} } from "${from}";\n---\n\n<${componentName}${props} />`;
    case "angular":
      return `import { ${componentName} } from "${from}";\n\n<svg vadivam${solid ? "Solid" : ""}${componentName}${props}></svg>`;
    case "lit":
      return `import { html } from "lit";\nimport { ${componentName} } from "${from}";\n\nhtml\`\${${componentName}(${props.trim()})}\`;`;
    case "flutter":
      return `import 'package:vadivam/vadivam.dart';\n\nVadivamIcon(${solid ? "VadivamSolidIcons" : "VadivamIcons"}.${dartIconName(componentName)}${props.trimStart()})`;
    case "compose":
      return `import com.praveenjuge.vadivam.*\nimport com.praveenjuge.vadivam.icons.${solid ? "solid." : ""}${componentName}\n\nIcon(\n    imageVector = ${solid ? "VadivamSolidIcons" : "VadivamIcons"}.${componentName}${props.trimStart()},\n)`;
    default:
      return `import { ${componentName} } from "${from}";\n\n<${componentName}${props} />`;
  }
}

/** Import-and-render snippet for one framework, with only the non-default props. */
export function componentSnippet(frameworkId, componentName, options = {}) {
  return componentSource(frameworkId, componentName, propsSource(frameworkId, options), isSolid(options) ? "solid" : "outline");
}

/** Apply size, color, and stroke settings to an icon's normalized SVG markup. */
export function customizeSvg(svg, options = {}) {
  const { size, color } = resolveOptions(options);
  if (isSolid(options)) {
    return svg
      .replace(/ width="[^"]*"/, ` width="${size}"`)
      .replace(/ height="[^"]*"/, ` height="${size}"`)
      .replace(/ fill="[^"]*"/, ` fill="${color}"`);
  }
  const strokeWidth = effectiveStrokeWidth(options);
  return svg
    .replace(/ width="[^"]*"/, ` width="${size}"`)
    .replace(/ height="[^"]*"/, ` height="${size}"`)
    .replace(/ stroke="[^"]*"/, ` stroke="${color}"`)
    .replace(/ stroke-width="[^"]*"/, ` stroke-width="${strokeWidth}"`);
}

const jsxAttributes = {
  "stroke-width": "strokeWidth",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "fill-rule": "fillRule",
  "clip-rule": "clipRule",
  class: "className",
};

/** Inline JSX for an SVG, for pasting into React without a package. */
export function svgToJsx(svg) {
  return svg
    .trim()
    .replace(/ ([a-z-]+)="/g, (match, name) => (jsxAttributes[name] ? ` ${jsxAttributes[name]}="` : match))
    .replace(/<path /g, "\n  <path ")
    .replace(/<(circle|rect|line|polyline|polygon|ellipse) /g, "\n  <$1 ")
    .replace(/\n?<\/svg>$/, "\n</svg>")
    .replace(/\n\n+/g, "\n");
}

/** A compact `data:` URI that is safe inside CSS `url("…")`. */
export function svgDataUri(svg) {
  const encoded = svg
    .trim()
    .replace(/\s+/g, " ")
    .replace(/"/g, "'")
    .replace(/[\r\n%#()<>?[\\\]^`{|}]/g, encodeURIComponent);
  return `data:image/svg+xml,${encoded}`;
}

export function svgBase64(svg) {
  const bytes = new TextEncoder().encode(svg.trim());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

/** A CSS mask so the icon takes the element's text color, at the chosen size and stroke. */
export function cssMaskSnippet(name, svg, options = {}) {
  const { size } = resolveOptions(options);
  // The mask only reads alpha, so the stroke color just has to be opaque.
  const mask = svgDataUri(customizeSvg(svg, { ...options, color: "#000" }));
  return `.icon-${name} {\n  display: inline-block;\n  width: ${size}px;\n  height: ${size}px;\n  background-color: currentColor;\n  mask: url("${mask}") no-repeat center / contain;\n}`;
}

// A Tailwind arbitrary-property class: base64 keeps spaces and quotes out of the class name.
export function tailwindMaskSnippet(svg, options = {}) {
  const { size } = resolveOptions(options);
  const mask = svgBase64(customizeSvg(svg, { ...options, color: "#000" }));
  return `<span class="inline-block size-[${size}px] bg-current [mask:url(${mask})_no-repeat_center/contain]" aria-hidden="true"></span>`;
}

export function cdnUrl(name, version, style = "outline") {
  const { entryDirectory } = styleOf(style);
  return `https://cdn.jsdelivr.net/npm/vadivam@${version}/dist/${entryDirectory ? `${entryDirectory}/` : ""}icons/${name}.svg`;
}

// The docs site serves each style's sprite at /sprite.svg and /sprite-solid.svg.
export function spriteSnippet(name, style = "outline") {
  const { paint, spriteIdPrefix } = styleOf(style);
  const file = style === "outline" ? "sprite.svg" : `sprite-${style}.svg`;
  return `<svg width="${canvasSize}" height="${canvasSize}" ${attributeString(paint)} aria-hidden="true">\n  <use href="/${file}#${spriteIdPrefix}${name}" />\n</svg>`;
}

export function fontSnippet(name, style = "outline") {
  return `<i class="${styleOf(style).font.baseClass} vadivam-icon-${name}" aria-hidden="true"></i>`;
}

export function iconifySnippet(name, style = "outline") {
  if (style === "solid") throw new Error("Iconify has the outline icons only; use another format for solid icons.");
  return `vadivam:${name}`;
}

export function shadcnItemUrl(name, baseUrl = siteUrl, style = "outline") {
  return `${baseUrl}/r/${style === "solid" ? "solid/" : ""}${name}.json`;
}

export function shadcnAddCommand(name, style = "outline") {
  return `npx shadcn@latest add ${shadcnItemUrl(name, siteUrl, style)}`;
}
