import { describe, expect, test } from "bun:test";
import {
  fetchLatestLucideCatalog,
  normalizeSvg,
  readIcons,
  shuffleUnique,
  updateIconCountMarkers,
  validateLucideIconNames,
  validateSvgContent,
} from "../scripts/icons.mjs";

const validSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16"/></svg>`;

describe("icon validation", () => {
  test("accepts a valid outline SVG", () => {
    expect(() => validateSvgContent(validSvg, "valid-fixture.svg")).not.toThrow();
  });

  test("rejects filled Figma exports before normalization", () => {
    const outlinedExport = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 2h20v20H2z" fill="black"/></svg>`;
    expect(() => normalizeSvg(outlinedExport, "outlined-export.svg")).toThrow(
      "filled artwork cannot be normalized",
    );
  });

  test("rejects compound paths that look like expanded strokes", () => {
    const closedShapes = Array.from(
      { length: 9 },
      (_value, index) => `M${index} 0h1v1h-1z`,
    ).join("");
    const expandedStroke = validSvg.replace("M4 12h16", closedShapes);
    expect(() => validateSvgContent(expandedStroke, "expanded-stroke.svg")).toThrow(
      "looks like expanded stroke geometry",
    );
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

  test("loads canonical names from the latest stable Lucide release", async () => {
    const requests = [];
    const fetchImpl = async (url) => {
      requests.push(url);
      if (url === "https://registry.npmjs.org/lucide/latest") {
        return Response.json({ version: "1.30.0" });
      }
      return Response.json({
        truncated: false,
        tree: [
          { path: "icons/check.svg" },
          { path: "icons/columns-2.svg" },
          { path: "icons/columns-2.json" },
          { path: "packages/lucide/icons/check.svg" },
        ],
      });
    };

    const catalog = await fetchLatestLucideCatalog(fetchImpl);
    expect(catalog.version).toBe("1.30.0");
    expect(catalog.names).toEqual(new Set(["check", "columns-2"]));
    expect(requests).toEqual([
      "https://registry.npmjs.org/lucide/latest",
      "https://api.github.com/repos/lucide-icons/lucide/git/trees/1.30.0?recursive=1",
    ]);
  });

  test("rejects deprecated and unknown Lucide icon filenames", () => {
    const catalog = { version: "1.30.0", names: new Set(["check", "columns-2"]) };
    expect(() =>
      validateLucideIconNames(["check.svg", "columns-2.svg"], catalog),
    ).not.toThrow();
    expect(() => validateLucideIconNames(["columns.svg", "custom.svg"], catalog)).toThrow(
      "Deprecated or non-canonical icon names for Lucide 1.30.0: columns.svg, custom.svg",
    );
  });

  test("updates every marked icon count without changing unrelated numbers", () => {
    const content = [
      "<!-- vadivam-icon-count:start -->",
      "Ships 240 icons at 24px.",
      "<!-- vadivam-icon-count:end -->",
      "Version 2 remains unchanged.",
    ].join("\n");
    expect(updateIconCountMarkers(content, 260)).toBe(
      content.replace("Ships 240 icons", "Ships 260 icons"),
    );
    expect(() => updateIconCountMarkers("Ships 240 icons.", 260)).toThrow(
      "missing vadivam icon count markers",
    );
  });
});

describe("OG icon selection", () => {
  test("shuffles every icon without repeating any", () => {
    const icons = ["one", "two", "three", "four"];
    const shuffled = shuffleUnique(icons, () => 0.25);

    expect(shuffled).not.toBe(icons);
    expect(shuffled).toHaveLength(icons.length);
    expect(new Set(shuffled)).toEqual(new Set(icons));
  });
});
