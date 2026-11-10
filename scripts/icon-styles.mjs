// The icon contract: what an icon file is, in every style, for everything that
// writes or reads one: validation, the generators, the docs site, the Figma
// plugins, and the MCP server (which ships a copy). Browser-safe: no imports.

export const canvasSize = 24;

export const canvasAttributes = Object.freeze({
  xmlns: "http://www.w3.org/2000/svg",
  width: canvasSize,
  height: canvasSize,
  viewBox: `0 0 ${canvasSize} ${canvasSize}`,
});

// The elements an icon may draw with and the attributes that carry their
// geometry. Order matters: icon nodes list elements in this order.
export const geometryAttributes = Object.freeze({
  path: ["d"],
  circle: ["cx", "cy", "r"],
  line: ["x1", "y1", "x2", "y2"],
  polyline: ["points"],
  polygon: ["points"],
  rect: ["x", "y", "width", "height", "rx", "ry"],
  ellipse: ["cx", "cy", "rx", "ry"],
});

export const svgElementTypes = Object.freeze(Object.keys(geometryAttributes).sort());

// Each style is one folder of SVGs with the same names. Outline icons are
// centerline strokes; solid icons are filled shapes whose cut-outs rely on the
// even-odd rule. Solid lines are 2.5px wide on the outline's centerlines, so
// their ink reaches 0.25px further into the padding than a 2px stroke. Each
// style has a font; the solid font reuses the outline font's codepoints and
// per-icon glyph classes, so only its family and base class differ.
const glyphClassPrefix = "vadivam-icon-";
export const styles = Object.freeze({
  outline: Object.freeze({
    id: "outline",
    sourceDirectory: "icons",
    entryDirectory: "",
    stroked: true,
    paint: Object.freeze({
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 2,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    }),
    inkWidth: 2,
    padding: 1,
    spriteIdPrefix: "vadivam-",
    font: Object.freeze({ fontName: "vadivam", fontFamily: "Vadivam Icons", baseClass: "vadivam-icon", glyphClassPrefix }),
  }),
  solid: Object.freeze({
    id: "solid",
    sourceDirectory: "icons-solid",
    entryDirectory: "solid",
    stroked: false,
    paint: Object.freeze({ fill: "currentColor", "fill-rule": "evenodd" }),
    inkWidth: 0,
    padding: 0.75,
    spriteIdPrefix: "vadivam-solid-",
    font: Object.freeze({ fontName: "vadivam-solid", fontFamily: "Vadivam Icons Solid", baseClass: "vadivam-solid-icon", glyphClassPrefix }),
  }),
});

export const styleIds = Object.freeze(Object.keys(styles));

export function styleOf(id = "outline") {
  if (!Object.hasOwn(styles, id)) throw new Error(`Unknown icon style: ${id}`);
  return styles[id];
}

/** The root attributes every icon file of a style carries, in file order. */
export function rootAttributes(style) {
  return { ...canvasAttributes, ...style.paint };
}

/** The root attribute that takes the icon color: an outline's `stroke`, a solid's `fill`. */
export function paintAttribute(style) {
  return Object.keys(style.paint).find((name) => style.paint[name] === "currentColor");
}

export function attributeString(attributes) {
  return Object.entries(attributes)
    .map(([name, value]) => `${name}="${value}"`)
    .join(" ");
}

export function rootTag(style) {
  return `<svg ${attributeString(rootAttributes(style))}>`;
}

/** An icon file of a style around already serialized elements. */
export function iconSvg(style, inner) {
  return `${rootTag(style)}\n${inner}\n</svg>\n`;
}

/** The markup between an SVG's root tags. */
export function svgInner(svg) {
  const open = svg.match(/<svg\b[^>]*>/);
  const close = svg.lastIndexOf("</svg>");
  if (!open || close < 0) throw new Error("SVG is missing its root.");
  return svg.slice(open.index + open[0].length, close).trim();
}

/** The `d` of every path in an SVG, in document order. */
export function svgPathData(svg) {
  return [...svg.matchAll(/<path\b[^>]*\sd="([^"]*)"/g)].map((match) => match[1]);
}

export const iconNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isIconName(name) {
  return typeof name === "string" && iconNamePattern.test(name);
}

export function pascalCase(name) {
  return name
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/** The SVG with its root width and height set to `size`. */
export function resizeSvg(svg, size) {
  return svg.replace(/ width="[^"]*"/, ` width="${size}"`).replace(/ height="[^"]*"/, ` height="${size}"`);
}

/** An icon file of a style drawn only with paths, given their `d` values. */
export function pathIconSvg(style, pathData) {
  return iconSvg(style, pathData.map((d) => `<path d="${d}"/>`).join(""));
}

/** A file's path in a style's entry of a package, such as `solid/sprite.svg`. */
export function entryPath(style, file) {
  return [style.entryDirectory, file].filter(Boolean).join("/");
}

/** A file's path in the published `vadivam` package for a style, such as `dist/solid/sprite.svg`. */
export function packagePath(style, file) {
  return `dist/${entryPath(style, file)}`;
}
