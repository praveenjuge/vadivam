import { paintAttribute, styles } from "../icon-styles.mjs";
import { defaultSize, defaultStrokeWidth, dynamicEntries, mergeClassesSource, write } from "./shared.mjs";

// <vadivam-icon> for plain HTML, htmx, Alpine, and any framework that renders
// custom elements. It ships inside the core package as `vadivam/elements` and
// lazy-loads the icon-node modules of each style's entry, which must already
// be built, so one CDN script covers every icon. `variant` picks the style:
// outline by default, or `variant="solid"` for the solid twin.
export async function buildElements(dist, iconsByStyle) {
  const entries = Object.values(styles).map((style) => ({ style, folder: style.entryDirectory ? `./${style.entryDirectory}/` : "./" }));
  const [defaultStyle] = entries;
  const styleTable = entries
    .map(({ style, folder }) => [
      `  ${style.id}: {`,
      `    createElement: ${style.id}CreateElement,`,
      `    paint: "${paintAttribute(style)}",`,
      `    stroked: ${style.stroked},`,
      `    imports: {`,
      dynamicEntries(iconsByStyle[style.id], { prefix: `${folder}icons/` }).replace(/^/gm, "    "),
      `    },`,
      `  },`,
    ].join("\n"))
    .join("\n");
  await write(dist, "elements.js", `${entries.map(({ style, folder }) => `import ${style.id}CreateElement from "${folder}createElement.js";`).join("\n")}
import { sanitizePaint } from "./runtimePolicy.js";

const styles = {
${styleTable}
};
export const iconNames = Object.keys(styles.${defaultStyle.style.id}.imports);

${mergeClassesSource()}

const loading = new Map();
function loadIcon(name, style) {
  if (!Object.prototype.hasOwnProperty.call(style.imports, name)) return Promise.resolve(null);
  const key = style.paint + ":" + name;
  let request = loading.get(key);
  if (!request) {
    request = style.imports[name]().then((module) => module.default, () => {
      loading.delete(key);
      return null;
    });
    loading.set(key, request);
  }
  return request;
}

// Sizes are CSS lengths; a bare number means pixels.
const lengthPattern = /^(?:\\d+|\\d*\\.\\d+)(?:px|em|rem|%|vw|vh|vmin|vmax|ch|ex)?$/;
function cssLength(value) {
  const length = value?.trim();
  if (!length || !lengthPattern.test(length)) return "${defaultSize}px";
  return /^[\\d.]+$/.test(length) ? length + "px" : length;
}

const HTMLElementBase = globalThis.HTMLElement ?? class {};

export class VadivamIconElement extends HTMLElementBase {
  static observedAttributes = ["name", "variant", "size", "color", "stroke-width", "absolute-stroke-width", "label"];
  #request = 0;
  #style;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    this.#style = document.createElement("style");
    root.append(this.#style);
  }

  connectedCallback() {
    this.#render();
  }

  attributeChangedCallback() {
    if (this.isConnected) this.#render();
  }

  async #render() {
    const request = ++this.#request;
    const size = cssLength(this.getAttribute("size"));
    // Styles on the element itself (width, height, color) win over :host.
    this.#style.textContent = \`:host{display:inline-block;flex-shrink:0;width:\${size};height:\${size};line-height:0;vertical-align:middle}svg{display:block;width:100%;height:100%}\`;
    const name = this.getAttribute("name") ?? "";
    const variant = this.getAttribute("variant");
    const style = Object.prototype.hasOwnProperty.call(styles, variant) ? styles[variant] : styles.${defaultStyle.style.id};
    const iconNode = await loadIcon(name, style);
    if (request !== this.#request) return;
    const strokeWidth = Number(this.getAttribute("stroke-width") ?? ${defaultStrokeWidth});
    const numericStroke = Number.isFinite(strokeWidth) && strokeWidth >= 0 ? strokeWidth : ${defaultStrokeWidth};
    const absolute = style.stroked && this.hasAttribute("absolute-stroke-width") && this.getAttribute("absolute-stroke-width") !== "false";
    const label = this.getAttribute("label");
    const paint = sanitizePaint(this.getAttribute("color") ?? undefined);
    // A solid icon is filled, so it takes no stroke settings.
    const svg = style.createElement(iconNode ?? [], {
      part: "svg",
      class: mergeClasses("vadivam", name && \`vadivam-\${name}\`),
      [style.paint]: paint,
      ...(style.stroked ? { "stroke-width": numericStroke } : {}),
      ...(label ? { role: "img", "aria-label": label } : { "aria-hidden": "true" }),
    });
    // The rendered size can come from em or % sizes and outside CSS, so an
    // absolute stroke is kept in screen pixels by the browser instead of being
    // computed from the size attribute.
    if (absolute) for (const shape of svg.children) shape.setAttribute("vector-effect", "non-scaling-stroke");
    if (label) {
      const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.textContent = label;
      svg.prepend(title);
    }
    this.shadowRoot.querySelector("svg")?.remove();
    this.shadowRoot.append(svg);
  }
}

if (globalThis.customElements && !customElements.get("vadivam-icon")) {
  customElements.define("vadivam-icon", VadivamIconElement);
}
`);
  await write(dist, "elements.d.ts", `import type { IconName } from "./types.js";
export declare const iconNames: readonly IconName[];
export declare class VadivamIconElement extends HTMLElement {
  static observedAttributes: string[];
  connectedCallback(): void;
  attributeChangedCallback(): void;
}
declare global {
  interface HTMLElementTagNameMap {
    "vadivam-icon": VadivamIconElement;
  }
}
`);
}
