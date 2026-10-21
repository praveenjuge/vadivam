// Client helpers shared by the homepage drawer and the icon pages: customizer
// settings, highlighted snippets, copy formats, downloads, and menus.
import {
  cdnUrl,
  componentSnippet,
  cssMaskSnippet,
  customizeSvg,
  effectiveStrokeWidth,
  fontSnippet,
  iconDefaults,
  iconifySnippet,
  propsSource,
  resolveOptions,
  shadcnAddCommand,
  spriteSnippet,
  svgBase64,
  svgDataUri,
  svgToJsx,
} from "../../../../scripts/snippets.mjs";
import type { SnippetTemplates } from "./snippet-templates";

export interface IconSettings {
  size: number;
  strokeWidth: number;
  color: string;
  absoluteStrokeWidth: boolean;
}

export interface IconRef {
  name: string;
  component: string;
  /** The canonical, uncustomized SVG markup. */
  svg: string;
}

const storageKey = "vadivam:settings";
const urlKeys = { size: "size", strokeWidth: "stroke", color: "color", absoluteStrokeWidth: "absolute" } as const;

export const isDefaultSettings = (settings: IconSettings) =>
  settings.size === iconDefaults.size &&
  settings.strokeWidth === iconDefaults.strokeWidth &&
  settings.color === iconDefaults.color &&
  !settings.absoluteStrokeWidth;

function readStoredSettings(): Partial<IconSettings> {
  try {
    return JSON.parse(localStorage.getItem(storageKey) ?? "{}");
  } catch {
    return {};
  }
}

function readUrlSettings(): Partial<IconSettings> {
  const params = new URLSearchParams(location.search);
  const settings: Partial<IconSettings> = {};
  if (params.has(urlKeys.size)) settings.size = Number(params.get(urlKeys.size));
  if (params.has(urlKeys.strokeWidth)) settings.strokeWidth = Number(params.get(urlKeys.strokeWidth));
  if (params.has(urlKeys.color)) settings.color = params.get(urlKeys.color) ?? undefined;
  if (params.has(urlKeys.absoluteStrokeWidth)) settings.absoluteStrokeWidth = params.get(urlKeys.absoluteStrokeWidth) === "true";
  return settings;
}

/**
 * One settings store per page. Settings persist across pages in localStorage;
 * pages that opt into `url` also mirror them into shareable query parameters,
 * which win over the stored values on load.
 */
export function createSettingsStore({ url = false } = {}) {
  // A shared link carries the sender's non-default settings, so the values it
  // leaves out are defaults, not the recipient's saved settings.
  const linked = url ? readUrlSettings() : {};
  let settings: IconSettings = resolveOptions(Object.keys(linked).length > 0 ? linked : readStoredSettings());
  const listeners = new Set<(settings: IconSettings) => void>();

  const syncUrl = () => {
    const next = new URL(location.href);
    for (const [key, param] of Object.entries(urlKeys) as [keyof IconSettings, string][]) {
      if (settings[key] === iconDefaults[key]) next.searchParams.delete(param);
      else next.searchParams.set(param, String(settings[key]));
    }
    history.replaceState(history.state, "", next);
  };

  return {
    get: () => settings,
    set(patch: Partial<IconSettings>) {
      settings = resolveOptions({ ...settings, ...patch });
      try {
        localStorage.setItem(storageKey, JSON.stringify(settings));
      } catch {
        // Private windows can refuse storage; the settings still apply to this page.
      }
      if (url) syncUrl();
      for (const listener of listeners) listener(settings);
    },
    reset() {
      this.set({ ...iconDefaults });
    },
    subscribe(listener: (settings: IconSettings) => void) {
      listeners.add(listener);
      listener(settings);
      return () => listeners.delete(listener);
    },
  };
}

export type SettingsStore = ReturnType<typeof createSettingsStore>;

export function readTemplates(id: string): SnippetTemplates | null {
  try {
    return JSON.parse(document.getElementById(id)?.textContent ?? "null");
  } catch {
    return null;
  }
}

export const escapeHtml = (value: string) =>
  value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char);

const pathData = (svg: string) => Array.from(svg.matchAll(/ d="([^"]*)"/g), (match) => match[1] ?? "");

/** Text snippet for copying: an SVG for the `svg` tab, else a component snippet. */
export function snippetText(tab: string, icon: IconRef, settings: IconSettings) {
  return tab === "svg" ? customizeSvg(icon.svg, settings) : componentSnippet(tab, icon.component, settings);
}

/** Highlighted snippet HTML from the build-time templates, with a plain fallback. */
export function snippetHtml(templates: SnippetTemplates | null, tab: string, icon: IconRef, settings: IconSettings) {
  const fallback = () => `<pre class="astro-code"><code>${escapeHtml(snippetText(tab, icon, settings))}</code></pre>`;
  if (!templates) return fallback();
  if (tab === "svg") {
    const paths = pathData(icon.svg);
    const template = templates.svg[String(paths.length)];
    if (!template) return fallback();
    const { size, color } = resolveOptions(settings);
    return paths
      .reduce((html, d, index) => html.split(`__D${index + 1}__`).join(d), template)
      .split("__SIZE__").join(String(size))
      .split("__COLOR__").join(escapeHtml(color))
      .split("__STROKE__").join(String(effectiveStrokeWidth(settings)));
  }
  const framework = templates.frameworks[tab];
  if (!framework) return fallback();
  const props = propsSource(tab, settings).trimStart();
  const html = props ? framework.props.split(templates.props).join(escapeHtml(props)) : framework.plain;
  return html.split(templates.component).join(icon.component);
}

export interface CopyFormat {
  id: string;
  label: string;
  value: (icon: IconRef, settings: IconSettings, version: string) => string;
}

export const copyFormats: CopyFormat[] = [
  { id: "svg", label: "SVG", value: (icon, settings) => customizeSvg(icon.svg, settings) },
  { id: "jsx", label: "JSX", value: (icon, settings) => svgToJsx(customizeSvg(icon.svg, settings)) },
  { id: "data-uri", label: "Data URI", value: (icon, settings) => svgDataUri(customizeSvg(icon.svg, settings)) },
  { id: "base64", label: "Base64", value: (icon, settings) => svgBase64(customizeSvg(icon.svg, settings)) },
  { id: "css-mask", label: "CSS mask", value: (icon, settings) => cssMaskSnippet(icon.name, icon.svg, settings) },
  { id: "cdn", label: "CDN URL", value: (icon, _settings, version) => cdnUrl(icon.name, version) },
  { id: "sprite", label: "Sprite <use>", value: (icon) => spriteSnippet(icon.name) },
  { id: "font", label: "Icon font", value: (icon) => fontSnippet(icon.name) },
  { id: "iconify", label: "Iconify name", value: (icon) => iconifySnippet(icon.name) },
  { id: "shadcn", label: "shadcn add", value: (icon) => shadcnAddCommand(icon.name) },
  { id: "name", label: "Icon name", value: (icon) => icon.name },
  { id: "component", label: "Component name", value: (icon) => icon.component },
];

/** The color an exported image uses: the page's text color stands in for `currentColor`. */
function resolvedColor(settings: IconSettings, element: Element) {
  return settings.color === "currentColor" ? getComputedStyle(element).color : settings.color;
}

export async function pngBlob(icon: IconRef, settings: IconSettings, scale: number, element: Element) {
  const pixels = Math.round(settings.size * scale);
  const svg = customizeSvg(icon.svg, { ...settings, color: resolvedColor(settings, element) })
    .replace(/ width="[^"]*"/, ` width="${pixels}"`)
    .replace(/ height="[^"]*"/, ` height="${pixels}"`);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = new Image(pixels, pixels);
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = pixels;
    canvas.height = pixels;
    canvas.getContext("2d")?.drawImage(image, 0, 0, pixels, pixels);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG export failed"))), "image/png"),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export const copyText = (value: string) => navigator.clipboard.writeText(value);

export function copyPng(icon: IconRef, settings: IconSettings, element: Element) {
  return navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob(icon, settings, 2, element) })]);
}

/** Run a Copy as / Download menu action. Returns a status message. */
export async function runAction(action: string, icon: IconRef, settings: IconSettings, version: string, element: Element) {
  if (action === "download-svg") {
    downloadBlob(new Blob([customizeSvg(icon.svg, settings)], { type: "image/svg+xml" }), `${icon.name}.svg`);
    return `Downloaded ${icon.name}.svg`;
  }
  const png = action.match(/^download-png-(\d)$/);
  if (png) {
    const scale = Number(png[1]);
    downloadBlob(await pngBlob(icon, settings, scale, element), `${icon.name}${scale > 1 ? `@${scale}x` : ""}.png`);
    return `Downloaded ${icon.name}.png`;
  }
  if (action === "copy-png") {
    await copyPng(icon, settings, element);
    return "PNG copied.";
  }
  const format = copyFormats.find((item) => `copy-${item.id}` === action);
  if (!format) return "";
  await copyText(format.value(icon, settings, version));
  return `${format.label} copied.`;
}

/** Anchor every `[popover]` menu under `root` to the button that opened it. */
export function wireMenus(root: ParentNode) {
  for (const menu of root.querySelectorAll<HTMLElement>("[popover][data-menu]")) {
    menu.addEventListener("toggle", (event) => {
      if ((event as ToggleEvent).newState !== "open") return;
      const invoker = root.querySelector<HTMLElement>(`[popovertarget="${menu.id}"]`);
      if (!invoker) return;
      const anchor = invoker.getBoundingClientRect();
      const { width, height } = menu.getBoundingClientRect();
      const margin = 8;
      const left = Math.min(Math.max(margin, anchor.right - width), innerWidth - width - margin);
      const below = anchor.bottom + 4;
      menu.style.left = `${left}px`;
      menu.style.top = `${below + height + margin > innerHeight ? Math.max(margin, anchor.top - height - 4) : below}px`;
      menu.querySelector<HTMLElement>("[data-action]")?.focus();
    });
    menu.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const items = Array.from(menu.querySelectorAll<HTMLElement>("[data-action]"));
      const index = items.indexOf(document.activeElement as HTMLElement);
      const next = items[(index + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length];
      next?.focus();
    });
    menu.addEventListener("click", (event) => {
      if ((event.target as HTMLElement).closest("[data-action]")) menu.hidePopover();
    });
  }
}

/** `rgb(…)` to `#rrggbb`, so a color input can show what `currentColor` resolves to. */
function toHex(color: string) {
  const channels = color.match(/\d+(\.\d+)?/g)?.slice(0, 3).map(Number) ?? [0, 0, 0];
  return `#${channels.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
}

/** Two-way bind a `<Customizer>` element to the settings store. */
export function bindCustomizer(element: HTMLElement, store: SettingsStore) {
  const input = (name: string) => element.querySelector<HTMLInputElement>(`[data-setting="${name}"]`);
  const output = (name: string) => element.querySelector<HTMLOutputElement>(`[data-output="${name}"]`);
  const size = input("size");
  const stroke = input("strokeWidth");
  const color = input("color");
  const absolute = input("absoluteStrokeWidth");

  size?.addEventListener("input", () => store.set({ size: Number(size.value) }));
  stroke?.addEventListener("input", () => store.set({ strokeWidth: Number(stroke.value) }));
  color?.addEventListener("input", () => store.set({ color: color.value }));
  absolute?.addEventListener("change", () => store.set({ absoluteStrokeWidth: absolute.checked }));
  element.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const preset = target.closest<HTMLElement>("[data-size-preset]");
    if (preset) store.set({ size: Number(preset.dataset.sizePreset) });
    if (target.closest("[data-reset-color]")) store.set({ color: "currentColor" });
    if (target.closest("[data-reset-all]")) store.reset();
  });

  return store.subscribe((settings) => {
    if (size && document.activeElement !== size) size.value = String(settings.size);
    if (stroke && document.activeElement !== stroke) stroke.value = String(settings.strokeWidth);
    if (color && document.activeElement !== color) {
      color.value = /^#[0-9a-f]{6}$/i.test(settings.color) ? settings.color : toHex(getComputedStyle(element).color);
    }
    if (absolute) absolute.checked = settings.absoluteStrokeWidth;
    const sizeOutput = output("size");
    if (sizeOutput) sizeOutput.textContent = `${settings.size}px`;
    const strokeOutput = output("strokeWidth");
    if (strokeOutput) strokeOutput.textContent = String(settings.strokeWidth);
    const colorOutput = output("color");
    if (colorOutput) colorOutput.textContent = settings.color;
    for (const preset of element.querySelectorAll<HTMLElement>("[data-size-preset]")) {
      preset.setAttribute("aria-pressed", String(Number(preset.dataset.sizePreset) === settings.size));
    }
    element.querySelector<HTMLElement>("[data-reset-color]")?.toggleAttribute("hidden", settings.color === "currentColor");
    element.querySelector<HTMLElement>("[data-reset-all]")?.toggleAttribute("disabled", isDefaultSettings(settings));
  });
}

/** Paint every `[data-icon-preview]` inside `root` with the customized icon. */
export function renderPreviews(root: ParentNode, icon: IconRef, settings: IconSettings) {
  for (const preview of root.querySelectorAll<HTMLElement>("[data-icon-preview]")) {
    const pixels = Number(preview.dataset.iconPreview) || settings.size;
    // A zoomed preview magnifies the icon at the chosen size; a sized preview
    // renders it at that size, so `absoluteStrokeWidth` adjusts its stroke.
    const markup = "zoom" in preview.dataset
      ? customizeSvg(icon.svg, settings)
          .replace(/ width="[^"]*"/, ` width="${pixels}"`)
          .replace(/ height="[^"]*"/, ` height="${pixels}"`)
      : customizeSvg(icon.svg, { ...settings, size: pixels });
    // Parse as SVG rather than assigning HTML, so URL-provided settings can
    // only ever become attribute values of this one element.
    svgParser ??= new DOMParser();
    const svg = svgParser.parseFromString(markup, "image/svg+xml").documentElement;
    preview.replaceChildren(document.importNode(svg, true));
  }
}

// Created on first use: this module is also imported at build time, where
// there is no DOM.
let svgParser: DOMParser | undefined;
