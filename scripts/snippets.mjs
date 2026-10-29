// Copy formats shared by the docs site, the shadcn registry, and the MCP
// server. Browser-safe: no Node imports.

export const iconDefaults = Object.freeze({
  size: 24,
  strokeWidth: 2,
  color: "currentColor",
  absoluteStrokeWidth: false,
});

export const frameworks = Object.freeze([
  { id: "react", label: "React", packageName: "vadivam-react", lang: "tsx" },
  { id: "react-native", label: "React Native", packageName: "vadivam-react-native", lang: "tsx" },
  { id: "vue", label: "Vue", packageName: "vadivam-vue", lang: "vue" },
  { id: "svelte", label: "Svelte", packageName: "vadivam-svelte", lang: "svelte" },
  { id: "solid", label: "Solid", packageName: "vadivam-solid", lang: "tsx" },
  { id: "preact", label: "Preact", packageName: "vadivam-preact", lang: "tsx" },
  { id: "astro", label: "Astro", packageName: "vadivam-astro", lang: "astro" },
  { id: "angular", label: "Angular", packageName: "vadivam-angular", lang: "ts" },
  { id: "qwik", label: "Qwik", packageName: "vadivam-qwik", lang: "tsx" },
  { id: "lit", label: "Lit", packageName: "vadivam-lit", lang: "ts" },
  { id: "flutter", label: "Flutter", packageName: "vadivam", registry: "pub", lang: "dart" },
  { id: "compose", label: "Compose", packageName: "com.praveenjuge:vadivam-compose", registry: "maven", lang: "kotlin" },
].map((framework) => ({ registry: "npm", ...framework })));

export const frameworksById = Object.freeze(
  Object.fromEntries(frameworks.map((framework) => [framework.id, framework])),
);

// Every icon is drawn in each of these styles. Solid icons are filled, so they
// take no stroke options.
export const iconStyles = Object.freeze(["outline", "solid"]);

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
  const value = absoluteStrokeWidth ? (strokeWidth * 24) / size : strokeWidth;
  return Number(value.toFixed(3));
}

/**
 * The command that adds a framework's package. npm packages honor `manager`.
 * @param {string} frameworkId
 * @param {{ manager?: string, version?: string }} [options]
 */
export function installCommand(frameworkId, { manager = "npm", version } = {}) {
  const framework = frameworksById[frameworkId];
  if (!framework) throw new Error(`Unknown framework: ${frameworkId}`);
  if (framework.registry === "pub") return `flutter pub add ${framework.packageName}`;
  if (framework.registry === "maven") return `implementation("${framework.packageName}:${version ?? "<version>"}")`;
  return `${manager} ${manager === "npm" ? "install" : "add"} ${framework.packageName}`;
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

export const siteUrl = "https://vadivam.praveenjuge.com";

export function cdnUrl(name, version, style = "outline") {
  return `https://cdn.jsdelivr.net/npm/vadivam@${version}/dist/${style === "solid" ? "solid/" : ""}icons/${name}.svg`;
}

export function spriteSnippet(name, style = "outline") {
  if (style === "solid") {
    return `<svg width="24" height="24" fill="currentColor" fill-rule="evenodd" aria-hidden="true">\n  <use href="/sprite-solid.svg#vadivam-solid-${name}" />\n</svg>`;
  }
  return `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">\n  <use href="/sprite.svg#vadivam-${name}" />\n</svg>`;
}

export function fontSnippet(name, style = "outline") {
  return `<i class="${style === "solid" ? "vadivam-solid-icon" : "vadivam-icon"} vadivam-icon-${name}" aria-hidden="true"></i>`;
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
