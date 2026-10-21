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
]);

export const frameworksById = Object.freeze(
  Object.fromEntries(frameworks.map((framework) => [framework.id, framework])),
);

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

function changedProps(options) {
  const resolved = resolveOptions(options);
  const props = [];
  if (resolved.size !== iconDefaults.size) props.push(["size", resolved.size]);
  if (resolved.color !== iconDefaults.color) props.push(["color", resolved.color]);
  if (resolved.strokeWidth !== iconDefaults.strokeWidth) props.push(["strokeWidth", resolved.strokeWidth]);
  if (resolved.absoluteStrokeWidth) props.push(["absoluteStrokeWidth", true]);
  return props;
}

const kebab = (name) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** The non-default props in one framework's attribute syntax, e.g. ` size={32}`. */
export function propsSource(frameworkId, options) {
  const props = changedProps(options);
  return props
    .map(([name, value]) => {
      if (frameworkId === "vue") {
        if (value === true) return kebab(name);
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

/** Import-and-render snippet for one framework, with only the non-default props. */
export function componentSnippet(frameworkId, componentName, options = {}) {
  const framework = frameworksById[frameworkId];
  if (!framework) throw new Error(`Unknown framework: ${frameworkId}`);
  const props = propsSource(frameworkId, options);
  const from = framework.packageName;
  switch (frameworkId) {
    case "vue":
      return `<script setup>\nimport { ${componentName} } from "${from}";\n</script>\n\n<template>\n  <${componentName}${props} />\n</template>`;
    case "svelte":
      return `<script>\n  import { ${componentName} } from "${from}";\n</script>\n\n<${componentName}${props} />`;
    case "astro":
      return `---\nimport { ${componentName} } from "${from}";\n---\n\n<${componentName}${props} />`;
    case "angular":
      return `import { ${componentName} } from "${from}";\n\n<svg vadivam${componentName}${props}></svg>`;
    default:
      return `import { ${componentName} } from "${from}";\n\n<${componentName}${props} />`;
  }
}

/** Apply size, color, and stroke settings to an icon's normalized SVG markup. */
export function customizeSvg(svg, options = {}) {
  const { size, color } = resolveOptions(options);
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

/** A CSS mask so the icon takes the element's text color. */
export function cssMaskSnippet(name, svg) {
  return `.icon-${name} {\n  display: inline-block;\n  width: 24px;\n  height: 24px;\n  background-color: currentColor;\n  mask: url("${svgDataUri(svg)}") no-repeat center / contain;\n}`;
}

export const siteUrl = "https://vadivam.praveenjuge.com";

export function cdnUrl(name, version) {
  return `https://cdn.jsdelivr.net/npm/vadivam@${version}/dist/icons/${name}.svg`;
}

export function spriteSnippet(name) {
  return `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">\n  <use href="/sprite.svg#vadivam-${name}" />\n</svg>`;
}

export function fontSnippet(name) {
  return `<i class="vadivam-icon vadivam-icon-${name}" aria-hidden="true"></i>`;
}

export function iconifySnippet(name) {
  return `vadivam:${name}`;
}

export function shadcnItemUrl(name, baseUrl = siteUrl) {
  return `${baseUrl}/r/${name}.json`;
}

export function shadcnAddCommand(name) {
  return `npx shadcn@latest add ${shadcnItemUrl(name)}`;
}
