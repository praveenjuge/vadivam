// Copy formats shared by the docs site, the shadcn registry, and the MCP
// server, which ships this file with the modules it imports.
// Browser-safe: imports only browser-safe modules.
import { attributeString, canvasSize, entryPath, packagePath, paintAttribute, resizeSvg, styleIds, styleOf, styles } from "./icon-styles.mjs";
import { angularSelectorPrefix, composePackage, dartIconName, iconsOwner, shadcnItemPath, styleEntry } from "./package-names.mjs";
import { frameworks, siteUrl, targetsById } from "./packages.mjs";

export { dartIconName, frameworks };

export const iconDefaults = Object.freeze({
  size: canvasSize,
  strokeWidth: styles.outline.paint["stroke-width"],
  color: styles.outline.paint.stroke,
  absoluteStrokeWidth: false,
});

const optionsStyle = (options) => styleOf(options?.style ?? "outline");

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

/** How to render an icon from a runtime name with a package, in one line for agents. */
export function dynamicIconUsage(targetId) {
  const { packageName, dynamicIcon } = targetsById[targetId];
  const docs = `${siteUrl}/docs/dynamic-icons`;
  if (dynamicIcon.lookup) return `${dynamicIcon.lookup} ${docs}`;
  const binding = dynamicIcon.export === "default" ? "DynamicIcon" : "{ DynamicIcon }";
  const directive = dynamicIcon.directive ? ` (directive: <svg ${dynamicIcon.directive} name="activity"></svg>)` : "";
  return `import ${binding} from "${packageName}/dynamic"${directive}. Validate runtime names against iconNames first. ${docs}`;
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
  if (!optionsStyle(options).stroked) return props;
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
    if (optionsStyle(options).stroked && (named.strokeWidth !== undefined || absoluteStrokeWidth)) {
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
export function componentSource(frameworkId, componentName, props, styleId = "outline") {
  const framework = targetsById[frameworkId];
  if (!framework?.framework) throw new Error(`Unknown framework: ${frameworkId}`);
  const style = styleOf(styleId);
  const from = styleEntry(framework.packageName, style);
  switch (frameworkId) {
    case "vue":
      return `<script setup>\nimport { ${componentName} } from "${from}";\n</script>\n\n<template>\n  <${componentName}${props} />\n</template>`;
    case "svelte":
      return `<script>\n  import { ${componentName} } from "${from}";\n</script>\n\n<${componentName}${props} />`;
    case "astro":
      return `---\nimport { ${componentName} } from "${from}";\n---\n\n<${componentName}${props} />`;
    case "angular":
      return `import { ${componentName} } from "${from}";\n\n<svg ${angularSelectorPrefix(style)}${componentName}${props}></svg>`;
    case "lit":
      return `import { html } from "lit";\nimport { ${componentName} } from "${from}";\n\nhtml\`\${${componentName}(${props.trim()})}\`;`;
    case "flutter":
      return `import 'package:vadivam/vadivam.dart';\n\nVadivamIcon(${iconsOwner(style)}.${dartIconName(componentName)}${props.trimStart()})`;
    case "compose":
      return `import com.praveenjuge.vadivam.*\nimport ${composePackage(style)}.${componentName}\n\nIcon(\n    imageVector = ${iconsOwner(style)}.${componentName}${props.trimStart()},\n)`;
    default:
      return `import { ${componentName} } from "${from}";\n\n<${componentName}${props} />`;
  }
}

/** Import-and-render snippet for one framework, with only the non-default props. */
export function componentSnippet(frameworkId, componentName, options = {}) {
  return componentSource(frameworkId, componentName, propsSource(frameworkId, options), optionsStyle(options).id);
}

/** Apply size, color, and stroke settings to an icon's normalized SVG markup. */
export function customizeSvg(svg, options = {}) {
  const { size, color } = resolveOptions(options);
  const style = optionsStyle(options);
  const painted = resizeSvg(svg, size).replace(new RegExp(` ${paintAttribute(style)}="[^"]*"`), ` ${paintAttribute(style)}="${color}"`);
  return style.stroked ? painted.replace(/ stroke-width="[^"]*"/, ` stroke-width="${effectiveStrokeWidth(options)}"`) : painted;
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

const iconFile = (name) => `icons/${name}.svg`;

/** An icon's SVG file as the vadivam package exports it, such as `solid/icons/house.svg`. */
export function iconAssetPath(name, style = "outline") {
  return entryPath(styleOf(style), iconFile(name));
}

export function cdnUrl(name, version, style = "outline") {
  return `https://cdn.jsdelivr.net/npm/${targetsById.core.packageName}@${version}/${packagePath(styleOf(style), iconFile(name))}`;
}

// Points at the package's sprite served from the app's root, with the solid
// sprite saved as sprite-solid.svg, as the core docs show.
export function spriteSnippet(name, style = "outline") {
  const { paint, spriteIdPrefix } = styleOf(style);
  const file = style === "outline" ? "sprite.svg" : `sprite-${style}.svg`;
  return `<svg width="${canvasSize}" height="${canvasSize}" ${attributeString(paint)} aria-hidden="true">\n  <use href="/${file}#${spriteIdPrefix}${name}" />\n</svg>`;
}

export function fontSnippet(name, style = "outline") {
  const { baseClass, glyphClassPrefix } = styleOf(style).font;
  return `<i class="${baseClass} ${glyphClassPrefix}${name}" aria-hidden="true"></i>`;
}

// Iconify publishes the outline icons only; the copy formats below say so.
export function iconifySnippet(name) {
  return `vadivam:${name}`;
}

export function shadcnItemUrl(name, baseUrl = siteUrl, style = "outline") {
  return `${baseUrl}/${shadcnItemPath(name, styleOf(style))}`;
}

export function shadcnAddCommand(name, style = "outline") {
  return `npx shadcn@latest add ${shadcnItemUrl(name, siteUrl, style)}`;
}

const styledSvg = (icon, options) => customizeSvg(icon.svg, options);

/**
 * Every format an icon can be copied as, in the order the MCP server lists
 * them. The docs site's Copy as menu shows the ones that aren't framework
 * snippets; its framework tabs show the rest. `render(icon, options, version)`
 * takes `{ name, componentName, svg }`, where `svg` is the uncustomized markup
 * of `options.style`. `install` is the package the output needs, if any.
 */
export const copyFormats = Object.freeze(
  [
    { id: "svg", label: "SVG", render: styledSvg },
    { id: "jsx", label: "JSX", render: (icon, options) => svgToJsx(styledSvg(icon, options)) },
    ...frameworks.map(({ id, label }) => ({
      id,
      label,
      framework: true,
      install: id,
      render: (icon, options) => componentSnippet(id, icon.componentName, options),
    })),
    { id: "data-uri", label: "Data URI", render: (icon, options) => svgDataUri(styledSvg(icon, options)) },
    { id: "base64", label: "Base64", render: (icon, options) => svgBase64(styledSvg(icon, options)) },
    { id: "css-mask", label: "CSS mask", render: (icon, options) => cssMaskSnippet(icon.name, icon.svg, options) },
    { id: "tailwind", label: "Tailwind class", render: (icon, options) => tailwindMaskSnippet(icon.svg, options) },
    { id: "cdn", label: "CDN URL", render: (icon, options, version) => cdnUrl(icon.name, version, options.style) },
    { id: "sprite", label: "Sprite <use>", install: "core", render: (icon, options) => spriteSnippet(icon.name, options.style) },
    { id: "font", label: "Icon font", install: "core", render: (icon, options) => fontSnippet(icon.name, options.style) },
    { id: "iconify", label: "Iconify name", styles: ["outline"], render: (icon) => iconifySnippet(icon.name) },
    { id: "shadcn", label: "shadcn add", render: (icon, options) => shadcnAddCommand(icon.name, options.style) },
  ].map((format) => Object.freeze({ styles: styleIds, framework: false, ...format })),
);

export const copyFormatsById = Object.freeze(Object.fromEntries(copyFormats.map((format) => [format.id, format])));

/** Why a format can't show an icon in a style, or null when it can. */
export function unsupportedStyle(format, style = "outline") {
  return format.styles.includes(style)
    ? null
    : `${format.label} has ${format.styles.join(" and ")} icons only; use another format for ${style} icons.`;
}

/** One icon in one copy format; throws for an unknown format or a style the format lacks. */
export function renderCopyFormat(formatId, icon, options = {}, version) {
  const format = copyFormatsById[formatId];
  if (!format) throw new Error(`Unknown format "${formatId}". Use one of: ${copyFormats.map(({ id }) => id).join(", ")}.`);
  const problem = unsupportedStyle(format, options.style);
  if (problem) throw new Error(problem);
  return format.render(icon, options, version);
}
