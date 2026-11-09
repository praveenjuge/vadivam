import { highlightCode } from "blume/markdown";
import { icons } from "vadivam/manifest";
import { attributeString, iconSvg, rootAttributes, rootTag, styleIds, styles, svgPathData } from "../../../../scripts/icon-styles.mjs";
import { componentSource, dartIconName, frameworks } from "../../../../scripts/snippets.mjs";
import type { IconStyle } from "./site";

// Shiki-highlighted snippet templates, rendered once at build time. The client
// swaps the placeholders for an icon's component name, props, and path data so
// every icon (and every customizer setting) shares one small set of templates.
// Distinct from real API names such as Flutter's `VadivamIcon` widget.
const componentPlaceholder = "VadivamComponentName";
const propsPlaceholder = "__PROPS__";

interface StyleTemplates {
  /** Per framework: `plain` has no props, `props` has a props placeholder. */
  frameworks: Record<string, { plain: string; props: string }>;
  /** Raw SVG shells keyed by path count, with `__Dn__` path placeholders. */
  svg: Record<string, string>;
}

export interface SnippetTemplates {
  component: string;
  dartComponent: string;
  props: string;
  styles: Record<IconStyle, StyleTemplates>;
}

type HighlightThemes = NonNullable<Parameters<typeof highlightCode>[2]>["themes"];

const pathCount = (svg: string) => svgPathData(svg).length;

/** Every distinct path count among a style's icons. */
function pathCounts(style: IconStyle) {
  const svgs = icons.map((icon) => (style === "solid" ? icon.solid?.svg : icon.svg) ?? "");
  return [...new Set(svgs.map(pathCount))].filter((count) => count > 0).sort((left, right) => left - right);
}

// A root tag whose size and paint are placeholders for the client to fill in.
function templateRootTag(style: IconStyle) {
  const { stroked } = styles[style];
  const attributes: Record<string, string | number> = {
    ...rootAttributes(styles[style]),
    width: "__SIZE__",
    height: "__SIZE__",
    [stroked ? "stroke" : "fill"]: "__COLOR__",
  };
  if (stroked) attributes["stroke-width"] = "__STROKE__";
  return `<svg ${attributeString(attributes)}>`;
}

// Every page of a build shares one set of templates, so each icon page
// doesn't re-run Shiki for the same snippets.
const cache = new Map<string, Promise<SnippetTemplates>>();

export function buildSnippetTemplates(themes: HighlightThemes): Promise<SnippetTemplates> {
  const key = JSON.stringify(themes);
  let templates = cache.get(key);
  if (!templates) {
    templates = renderSnippetTemplates(themes);
    cache.set(key, templates);
  }
  return templates;
}

/** The templates one icon page needs: the SVG shells for its own path counts only. */
export function iconTemplates(templates: SnippetTemplates, svgs: Record<IconStyle, string>): SnippetTemplates {
  const trimmed = (style: IconStyle) => {
    const count = String(pathCount(svgs[style]));
    return { ...templates.styles[style], svg: { [count]: templates.styles[style].svg[count] ?? "" } };
  };
  return { ...templates, styles: { outline: trimmed("outline"), solid: trimmed("solid") } };
}

async function renderStyleTemplates(
  highlight: (code: string, lang: string) => Promise<string>,
  style: IconStyle,
): Promise<StyleTemplates> {
  const result: StyleTemplates = { frameworks: {}, svg: {} };
  const dartPlaceholder = dartIconName(componentPlaceholder);
  for (const framework of frameworks) {
    const plain = await highlight(componentSource(framework.id, componentPlaceholder, "", style), framework.lang);
    const props = await highlight(componentSource(framework.id, componentPlaceholder, ` ${propsPlaceholder}`, style), framework.lang);
    // The client swaps placeholders by plain string replacement, so each must
    // survive highlighting as one unbroken token.
    const name = framework.id === "flutter" ? dartPlaceholder : componentPlaceholder;
    if (!plain.includes(name) || !props.includes(propsPlaceholder)) {
      throw new Error(`${framework.id} snippet placeholders were split by the highlighter`);
    }
    result.frameworks[framework.id] = { plain, props };
  }
  for (const count of pathCounts(style)) {
    const paths = Array.from({ length: count }, (_, index) => `<path d="__D${index + 1}__"/>`).join("");
    const svg = iconSvg(styles[style], paths).replace(rootTag(styles[style]), templateRootTag(style));
    result.svg[count] = await highlight(svg.trimEnd(), "html");
  }
  return result;
}

async function renderSnippetTemplates(themes: HighlightThemes): Promise<SnippetTemplates> {
  const highlight = (code: string, lang: string) => highlightCode(code, lang, { icons: false, themes });
  const entries = await Promise.all((styleIds as IconStyle[]).map(async (style) => [style, await renderStyleTemplates(highlight, style)] as const));
  return {
    component: componentPlaceholder,
    dartComponent: dartIconName(componentPlaceholder),
    props: propsPlaceholder,
    styles: Object.fromEntries(entries) as Record<IconStyle, StyleTemplates>,
  };
}

/** Serialize for an inline JSON island; `</` can't close the script early. */
export function serializeForScript(value: unknown): string {
  return JSON.stringify(value).replaceAll("</", "<\\/");
}
