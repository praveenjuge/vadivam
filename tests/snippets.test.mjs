import { describe, expect, test } from "bun:test";
import {
  componentSnippet,
  cssMaskSnippet,
  customizeSvg,
  effectiveStrokeWidth,
  frameworks,
  propsSource,
  resolveOptions,
  svgBase64,
  svgDataUri,
  svgToJsx,
  tailwindMaskSnippet,
} from "../scripts/snippets.mjs";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n<path d="M4 12h16"/><path d="m12 4 8 8-8 8"/>\n</svg>\n`;
const custom = { size: 32, strokeWidth: 1.5, color: "#e11d48", absoluteStrokeWidth: true };

describe("copy formats", () => {
  test("default settings render a bare component for every framework", () => {
    for (const { id, packageName } of frameworks) {
      const snippet = componentSnippet(id, "ArrowRight");
      expect(snippet).toContain(`from "${packageName}"`);
      expect(propsSource(id, {})).toBe("");
    }
    expect(componentSnippet("angular", "ArrowRight")).toContain("<svg vadivamArrowRight></svg>");
  });

  test("custom settings use each framework's prop syntax", () => {
    expect(propsSource("react", custom)).toBe(' size={32} color="#e11d48" strokeWidth={1.5} absoluteStrokeWidth');
    expect(propsSource("vue", custom)).toBe(' :size="32" color="#e11d48" :stroke-width="1.5" :absolute-stroke-width="true"');
    expect(propsSource("angular", custom)).toBe(' [size]="32" color="#e11d48" [strokeWidth]="1.5" [absoluteStrokeWidth]="true"');
  });

  test("customized SVG matches the components' absolute stroke math", () => {
    expect(effectiveStrokeWidth(custom)).toBe(1.125);
    const result = customizeSvg(svg, custom);
    expect(result).toContain(' width="32" height="32"');
    expect(result).toContain(' stroke="#e11d48" stroke-width="1.125"');
    expect(customizeSvg(svg, {})).toBe(svg);
  });

  test("rejects unsafe or invalid settings", () => {
    expect(resolveOptions({ size: -1, strokeWidth: "x", color: '"><script>' })).toEqual({
      size: 24,
      strokeWidth: 2,
      color: "currentColor",
      absoluteStrokeWidth: false,
    });
  });

  test("CSS mask applies size and stroke settings", () => {
    const css = cssMaskSnippet("arrow", svg, { size: 48, strokeWidth: 1.5 });
    expect(css).toContain("width: 48px;\n  height: 48px;");
    expect(css).toContain("stroke-width='1.5'");
    expect(css).toContain("stroke='%23000'");
    expect(cssMaskSnippet("arrow", svg)).toContain("width: 24px;");
  });

  test("Tailwind mask is one class list with no spaces in the mask value", () => {
    const html = tailwindMaskSnippet(svg, { size: 20, strokeWidth: 1.5 });
    expect(html).toStartWith(`<span class="inline-block size-[20px] bg-current [mask:url(data:image/svg+xml;base64,`);
    const mask = html.match(/\[mask:url\(([^)]*)\)/)?.[1] ?? "";
    expect(mask).not.toContain(" ");
    const decoded = atob(mask.split(",")[1]);
    expect(decoded).toContain('stroke-width="1.5"');
    expect(decoded).toContain('stroke="#000"');
    expect(tailwindMaskSnippet(svg)).toContain("size-[24px]");
  });

  test("JSX, data URI, and Base64 outputs", () => {
    const jsx = svgToJsx(svg);
    expect(jsx).toContain('strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"');
    expect(jsx).not.toContain("stroke-width");
    const uri = svgDataUri(svg);
    expect(uri).toStartWith("data:image/svg+xml,%3Csvg");
    expect(uri).not.toMatch(/[<>"#]/);
    const base64 = svgBase64(svg);
    expect(atob(base64.split(",")[1])).toBe(svg.trim());
  });
});
