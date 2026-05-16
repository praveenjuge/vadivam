import { describe, expect, test } from "bun:test";
import { readIcons, validateSvgContent } from "../scripts/icons.mjs";

const validSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16"/></svg>`;

describe("icon validation", () => {
  test("accepts a valid outline SVG", () => {
    expect(() => validateSvgContent(validSvg, "valid-fixture.svg")).not.toThrow();
  });

  test.each([
    ["wrong viewBox", validSvg.replace("0 0 24 24", "0 0 32 32")],
    ["black stroke", validSvg.replace("currentColor", "black")],
    ["filled path", validSvg.replace("<path", '<path fill="red"')],
    ["square caps", validSvg.replace("round", "square")],
    ["wrong stroke width", validSvg.replace('stroke-width="2"', 'stroke-width="1.5"')],
    ["unsafe markup", validSvg.replace("<path", "<script/><path")]
  ])("rejects %s", (_name, svg) => {
    expect(() => validateSvgContent(svg, "invalid-fixture.svg")).toThrow();
  });

  test("validates every canonical icon", async () => {
    const icons = await readIcons();
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon.svgPath).toBe(`icons/${icon.fileName}`);
      expect(icon.componentName).toMatch(/^[A-Z][A-Za-z0-9]*$/);
    }
  });
});
