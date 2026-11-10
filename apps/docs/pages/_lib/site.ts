// Choices the homepage and the icon pages share: what they remember, the
// sizes they preview, and how a page's address carries the icon style.
// Browser-safe, and also imported at build time.
import { styleIds, styleOf, type styles } from "../../../../scripts/icon-styles.mjs";

export type IconStyle = keyof typeof styles;

/** The style pages show first and addresses leave out: outline. */
export const defaultStyle = styleOf().id as IconStyle;

export const isIconStyle = (value: unknown): value is IconStyle => (styleIds as readonly unknown[]).includes(value);

/** localStorage keys. Every choice persists across pages and visits. */
export const storageKeys = {
  settings: "vadivam:settings",
  tab: "vadivam:tab",
  packageManager: "vadivam:package-manager",
  previewBackground: "vadivam:preview-background",
  compare: "vadivam:compare",
  pixelGrid: "vadivam:pixel-grid",
} as const;

/** The framework tab shown until the visitor picks another. */
export const defaultTab = "react";

/** The sizes the customizer offers as presets and the pages preview side by side. */
export const sizePresets = [16, 20, 24, 32, 48];

/** npm-compatible managers; the first is the default. */
export const packageManagers = ["npm", "pnpm", "bun", "yarn"];

// Private windows can refuse storage; a choice then lasts only for the page.
export function recall(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // See recall.
  }
}

/** Set or, for null, delete query parameters. Replace, never push: Astro's client router owns history entries. */
export function setUrlParams(params: Record<string, string | null>) {
  const url = new URL(location.href);
  for (const [name, value] of Object.entries(params)) {
    if (value) url.searchParams.set(name, value);
    else url.searchParams.delete(name);
  }
  history.replaceState(history.state, "", url);
}

/** `?style=solid` shows the solid twin; the default style leaves no parameter. */
export const styleParam = (style: IconStyle) => (style === defaultStyle ? null : style);

export const styleFromUrl = (): IconStyle => {
  const style = new URLSearchParams(location.search).get("style");
  return isIconStyle(style) ? style : defaultStyle;
};

// Icon names are URL-safe already; encoding keeps text read from the DOM out of the markup.
export const iconPagePath = (name: string, style: IconStyle = defaultStyle) => {
  const param = styleParam(style);
  return `/icons/${encodeURIComponent(name)}${param ? `?style=${param}` : ""}`;
};

/** A live region that shows each message for two seconds. */
export function statusLine(element: HTMLElement) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (message: string) => {
    element.textContent = message;
    clearTimeout(timer);
    timer = setTimeout(() => (element.textContent = ""), 2000);
  };
}

/**
 * Where a missing page points readers and agents. The 404 page lists these,
 * and the docs build writes them into its Markdown and JSON twins.
 */
export const notFound = {
  title: "Page not found",
  description: "We couldn't find the page you're looking for.",
  suggestions: "Where to go next",
  links: [
    { path: "/", label: "Icon catalog" },
    { path: "/docs", label: "Documentation" },
    { path: "/changelog", label: "Changelog" },
    { path: "/sitemap.xml", label: "Sitemap" },
    { path: "/llms.txt", label: "llms.txt" },
    { path: "/openapi.json", label: "OpenAPI description" },
    { path: "/robots.txt", label: "robots.txt" },
  ],
};
