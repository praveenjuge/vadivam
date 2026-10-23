import "./mock.mjs";
import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { render } from "@testing-library/react";

const outline = await import("vadivam-react-native");
const solid = await import("vadivam-react-native/solid");

describe("vadivam-react-native/solid", () => {
  test("paints a fill on the Svg and every shape, with no stroke", () => {
    const { container } = render(
      createElement(outline.VadivamProvider, { color: "red", strokeWidth: 3 }, createElement(solid.Activity, { size: 32 })),
    );
    const svg = container.querySelector("svg");
    expect(svg.getAttribute("width")).toBe("32");
    expect(svg.getAttribute("fill")).toBe("red");
    expect(svg.getAttribute("fill-rule")).toBe("evenodd");
    expect(svg.getAttribute("stroke")).toBeNull();
    expect(svg.getAttribute("stroke-width")).toBeNull();
    const path = svg.querySelector("path");
    expect(path.getAttribute("fill")).toBe("red");
    expect(path.getAttribute("fill-rule")).toBe("evenodd");
    expect(path.getAttribute("stroke")).toBeNull();
  });

  test("exports solid twins beside the shared provider", () => {
    expect(solid.Activity).not.toBe(outline.Activity);
    expect(solid.VadivamProvider).toBe(outline.VadivamProvider);
    expect(Object.keys(solid.dynamicIconImports)).toHaveLength(Object.keys(outline.dynamicIconImports).length);
  });
});
