import { highlightCode } from "blume/markdown";
import { componentSource, dartIconName, frameworks } from "../../../../scripts/snippets.mjs";

// Shiki-highlighted snippet templates, rendered once at build time. The client
// swaps the placeholders for an icon's component name, props, and path data so
// every icon (and every customizer setting) shares one small set of templates.
// Distinct from real API names such as Flutter's `VadivamIcon` widget.
export const COMPONENT_PLACEHOLDER = "VadivamComponentName";
export const DART_COMPONENT_PLACEHOLDER = dartIconName(COMPONENT_PLACEHOLDER);
export const PROPS_PLACEHOLDER = "__PROPS__";
export const SVG_OPEN_TAG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';

const svgTemplateOpenTag =
  '<svg xmlns="http://www.w3.org/2000/svg" width="__SIZE__" height="__SIZE__" viewBox="0 0 24 24" fill="none" stroke="__COLOR__" stroke-width="__STROKE__" stroke-linecap="round" stroke-linejoin="round">';

export interface SnippetTemplates {
  component: string;
  dartComponent: string;
  props: string;
  svgOpenTag: string;
  /** Per framework: `plain` has no props, `props` has a props placeholder. */
  frameworks: Record<string, { plain: string; props: string }>;
  /** Raw SVG shells keyed by path count, with `__Dn__` path placeholders. */
  svg: Record<string, string>;
}

type HighlightThemes = NonNullable<Parameters<typeof highlightCode>[2]>["themes"];

// Every page of a build shares one set of templates, so each icon page
// doesn't re-run Shiki for the same snippets.
const cache = new Map<string, Promise<SnippetTemplates>>();

export function buildSnippetTemplates(themes: HighlightThemes, pathCounts: number[]): Promise<SnippetTemplates> {
  const key = JSON.stringify([themes, [...pathCounts].sort((left, right) => left - right)]);
  let templates = cache.get(key);
  if (!templates) {
    templates = renderSnippetTemplates(themes, pathCounts);
    cache.set(key, templates);
  }
  return templates;
}

async function renderSnippetTemplates(themes: HighlightThemes, pathCounts: number[]): Promise<SnippetTemplates> {
  const highlight = (code: string, lang: string) => highlightCode(code, lang, { icons: false, themes });
  const result: SnippetTemplates = {
    component: COMPONENT_PLACEHOLDER,
    dartComponent: DART_COMPONENT_PLACEHOLDER,
    props: PROPS_PLACEHOLDER,
    svgOpenTag: SVG_OPEN_TAG,
    frameworks: {},
    svg: {},
  };
  for (const framework of frameworks) {
    const plain = await highlight(componentSource(framework.id, COMPONENT_PLACEHOLDER, ""), framework.lang);
    const props = await highlight(componentSource(framework.id, COMPONENT_PLACEHOLDER, ` ${PROPS_PLACEHOLDER}`), framework.lang);
    // The client swaps placeholders by plain string replacement, so each must
    // survive highlighting as one unbroken token.
    const name = framework.id === "flutter" ? DART_COMPONENT_PLACEHOLDER : COMPONENT_PLACEHOLDER;
    if (!plain.includes(name) || !props.includes(PROPS_PLACEHOLDER)) {
      throw new Error(`${framework.id} snippet placeholders were split by the highlighter`);
    }
    result.frameworks[framework.id] = { plain, props };
  }
  for (const count of pathCounts) {
    const paths = Array.from({ length: count }, (_, index) => `<path d="__D${index + 1}__"/>`).join("");
    result.svg[count] = await highlight(`${svgTemplateOpenTag}\n${paths}\n</svg>`, "html");
  }
  return result;
}

/** Serialize for an inline JSON island; `</` can't close the script early. */
export function serializeForScript(value: unknown): string {
  return JSON.stringify(value).replaceAll("</", "<\\/");
}
