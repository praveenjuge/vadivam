import { dynamicEntries, write } from "./shared.mjs";

// <vadivam-icon> for plain HTML, htmx, Alpine, and any framework that renders
// custom elements. It ships inside the core package as `vadivam/elements` and
// lazy-loads the core icon-node modules, so one CDN script covers every icon.
export async function buildElements(icons, dist) {
  await write(dist, "elements.js", `import createElement from "./createElement.js";
import { sanitizePaint } from "./runtimePolicy.js";

const iconImports = {
${dynamicEntries(icons)}
};
export const iconNames = Object.keys(iconImports);

const loading = new Map();
function loadIcon(name) {
  if (!Object.prototype.hasOwnProperty.call(iconImports, name)) return Promise.resolve(null);
  let request = loading.get(name);
  if (!request) {
    request = iconImports[name]().then((module) => module.default, () => {
      loading.delete(name);
      return null;
    });
    loading.set(name, request);
  }
  return request;
}

// Sizes are CSS lengths; a bare number means pixels.
const lengthPattern = /^(?:\\d+|\\d*\\.\\d+)(?:px|em|rem|%|vw|vh|vmin|vmax|ch|ex)?$/;
function cssLength(value) {
  const length = value?.trim();
  if (!length || !lengthPattern.test(length)) return "24px";
  return /^[\\d.]+$/.test(length) ? length + "px" : length;
}

const HTMLElementBase = globalThis.HTMLElement ?? class {};

export class VadivamIconElement extends HTMLElementBase {
  static observedAttributes = ["name", "size", "color", "stroke-width", "absolute-stroke-width", "label"];
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
    const iconNode = await loadIcon(name);
    if (request !== this.#request) return;
    const strokeWidth = Number(this.getAttribute("stroke-width") ?? 2);
    const numericStroke = Number.isFinite(strokeWidth) && strokeWidth >= 0 ? strokeWidth : 2;
    const absolute = this.hasAttribute("absolute-stroke-width") && this.getAttribute("absolute-stroke-width") !== "false";
    const label = this.getAttribute("label");
    const svg = createElement(iconNode ?? [], {
      part: "svg",
      class: name ? \`vadivam vadivam-\${name}\` : "vadivam",
      stroke: sanitizePaint(this.getAttribute("color") ?? undefined),
      "stroke-width": numericStroke,
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
