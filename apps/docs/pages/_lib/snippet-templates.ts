import { highlightCode } from "blume/markdown";
import { frameworks } from "../../../../scripts/snippets.mjs";

// Shiki-highlighted snippet templates, rendered once at build time. The client
// swaps the placeholders for an icon's component name, props, and path data so
// every icon (and every customizer setting) shares one small set of templates.
export const COMPONENT_PLACEHOLDER = "VadivamIcon";
export const PROPS_PLACEHOLDER = "__PROPS__";
export const SVG_OPEN_TAG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
export const SOLID_SVG_OPEN_TAG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd">';

const svgTemplateOpenTag =
  '<svg xmlns="http://www.w3.org/2000/svg" width="__SIZE__" height="__SIZE__" viewBox="0 0 24 24" fill="none" stroke="__COLOR__" stroke-width="__STROKE__" stroke-linecap="round" stroke-linejoin="round">';
const solidSvgTemplateOpenTag =
  '<svg xmlns="http://www.w3.org/2000/svg" width="__SIZE__" height="__SIZE__" viewBox="0 0 24 24" fill="__COLOR__" fill-rule="evenodd">';

export type IconStyle = "outline" | "solid";

function frameworkSource(id: string, props: string, style: IconStyle = "outline"): string {
  const name = COMPONENT_PLACEHOLDER;
  const packageName = frameworks.find((framework) => framework.id === id)?.packageName;
  const from = style === "solid" ? `${packageName}/solid` : packageName;
  switch (id) {
    case "vue":
      return `<script setup>\nimport { ${name} } from "${from}";\n</script>\n\n<template>\n  <${name}${props} />\n</template>`;
    case "svelte":
      return `<script>\n  import { ${name} } from "${from}";\n</script>\n\n<${name}${props} />`;
    case "astro":
      return `---\nimport { ${name} } from "${from}";\n---\n\n<${name}${props} />`;
    case "angular":
      return `import { ${name} } from "${from}";\n\n<svg vadivam${style === "solid" ? "Solid" : ""}${name}${props}></svg>`;
    default:
      return `import { ${name} } from "${from}";\n\n<${name}${props} />`;
  }
}

interface StyleTemplates {
  svgOpenTag: string;
  /** Per framework: `plain` has no props, `props` has a props placeholder. */
  frameworks: Record<string, { plain: string; props: string }>;
  /** Raw SVG shells keyed by path count, with `__Dn__` path placeholders. */
  svg: Record<string, string>;
}

export interface SnippetTemplates extends StyleTemplates {
  component: string;
  props: string;
  /** The same templates for the solid twin. */
  solid: StyleTemplates;
}

type HighlightThemes = NonNullable<Parameters<typeof highlightCode>[2]>["themes"];

// Every page of a build shares one set of templates, so each icon page
// doesn't re-run Shiki for the same snippets.
const cache = new Map<string, Promise<SnippetTemplates>>();

export function buildSnippetTemplates(
  themes: HighlightThemes,
  pathCounts: number[],
  solidPathCounts: number[] = [],
): Promise<SnippetTemplates> {
  const sorted = (counts: number[]) => [...counts].sort((left, right) => left - right);
  const key = JSON.stringify([themes, sorted(pathCounts), sorted(solidPathCounts)]);
  let templates = cache.get(key);
  if (!templates) {
    templates = renderSnippetTemplates(themes, pathCounts, solidPathCounts);
    cache.set(key, templates);
  }
  return templates;
}

async function renderStyleTemplates(
  highlight: (code: string, lang: string) => Promise<string>,
  pathCounts: number[],
  style: IconStyle,
): Promise<StyleTemplates> {
  const result: StyleTemplates = {
    svgOpenTag: style === "solid" ? SOLID_SVG_OPEN_TAG : SVG_OPEN_TAG,
    frameworks: {},
    svg: {},
  };
  for (const framework of frameworks) {
    const plain = await highlight(frameworkSource(framework.id, "", style), framework.lang);
    const props = await highlight(frameworkSource(framework.id, ` ${PROPS_PLACEHOLDER}`, style), framework.lang);
    // The client swaps placeholders by plain string replacement, so each must
    // survive highlighting as one unbroken token.
    if (!plain.includes(COMPONENT_PLACEHOLDER) || !props.includes(PROPS_PLACEHOLDER)) {
      throw new Error(`${framework.id} snippet placeholders were split by the highlighter`);
    }
    result.frameworks[framework.id] = { plain, props };
  }
  const openTag = style === "solid" ? solidSvgTemplateOpenTag : svgTemplateOpenTag;
  for (const count of pathCounts) {
    const paths = Array.from({ length: count }, (_, index) => `<path d="__D${index + 1}__"/>`).join("");
    result.svg[count] = await highlight(`${openTag}\n${paths}\n</svg>`, "html");
  }
  return result;
}

async function renderSnippetTemplates(
  themes: HighlightThemes,
  pathCounts: number[],
  solidPathCounts: number[],
): Promise<SnippetTemplates> {
  const highlight = (code: string, lang: string) => highlightCode(code, lang, { icons: false, themes });
  return {
    component: COMPONENT_PLACEHOLDER,
    props: PROPS_PLACEHOLDER,
    ...(await renderStyleTemplates(highlight, pathCounts, "outline")),
    solid: await renderStyleTemplates(highlight, solidPathCounts, "solid"),
  };
}

/** Serialize for an inline JSON island; `</` can't close the script early. */
export function serializeForScript(value: unknown): string {
  return JSON.stringify(value).replaceAll("</", "<\\/");
}
