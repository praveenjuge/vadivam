import "./mock.mjs";
import { describe, expect, test } from "bun:test";
import React, { createElement, createRef } from "react";
import { render } from "@testing-library/react";

const {
  Activity,
  Icon,
  VadivamProvider,
  createVadivamIcon,
} = await import("vadivam-react-native");

function renderActivity(props = {}, children) {
  const { container } = render(createElement(Activity, props, children));
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("icon did not render a native Svg component");
  return { container, svg };
}

describe("vadivam-react-native Icon", () => {
  test("renders native SVG defaults", () => {
    const { svg } = renderActivity();
    expect(svg.getAttribute("width")).toBe("24");
    expect(svg.getAttribute("height")).toBe("24");
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.getAttribute("fill")).toBe("none");
    expect(svg.getAttribute("stroke")).toBe("currentColor");
    expect(svg.getAttribute("stroke-width")).toBe("2");
    expect(svg.querySelector("path")).not.toBeNull();
  });

  test("supports numeric and string sizes", () => {
    expect(renderActivity({ size: 40 }).svg.getAttribute("width")).toBe("40");
    expect(renderActivity({ size: "2em" }).svg.getAttribute("height")).toBe("2em");
  });

  test("supports color, stroke, strokeWidth, fill and arbitrary SvgProps", () => {
    const { svg } = renderActivity({
      color: "red",
      stroke: "blue",
      strokeWidth: 4,
      fill: "gold",
      className: "nativewind-icon",
      accessibilityLabel: "Activity",
      "data-native": "yes",
    });
    expect(svg.getAttribute("stroke")).toBe("blue");
    expect(svg.getAttribute("stroke-width")).toBe("4");
    expect(svg.getAttribute("fill")).toBe("gold");
    expect(svg.getAttribute("class")).toBe("nativewind-icon");
    expect(svg.getAttribute("data-native")).toBe("yes");
  });

  test("maps testID and preserves data-testid", () => {
    expect(renderActivity({ testID: "activity" }).svg.getAttribute("data-testid")).toBe("activity");
    expect(renderActivity({ "data-testid": "activity-data" }).svg.getAttribute("data-testid")).toBe("activity-data");
  });

  test("calculates absolute stroke width only for valid numeric sizes", () => {
    expect(
      renderActivity({ size: 48, strokeWidth: 2, absoluteStrokeWidth: true }).svg.getAttribute("stroke-width"),
    ).toBe("1");
    expect(
      renderActivity({ size: "2em", strokeWidth: 3, absoluteStrokeWidth: true }).svg.getAttribute("stroke-width"),
    ).toBe("3");
    expect(
      renderActivity({ size: 0, strokeWidth: 3, absoluteStrokeWidth: true }).svg.getAttribute("stroke-width"),
    ).toBe("3");
  });

  test("applies provider defaults and local overrides", () => {
    const { container } = render(
      createElement(
        VadivamProvider,
        { size: 48, color: "purple", strokeWidth: 4, absoluteStrokeWidth: true },
        createElement(Activity, { size: 32, color: "green" }),
      ),
    );
    const svg = container.querySelector("svg");
    expect(svg.getAttribute("width")).toBe("32");
    expect(svg.getAttribute("stroke")).toBe("green");
    expect(svg.getAttribute("stroke-width")).toBe("3");
  });

  test("forwards a native Svg ref", () => {
    const ref = createRef();
    render(createElement(Activity, { ref }));
    expect(ref.current?.tagName.toLowerCase()).toBe("svg");
  });

  test("renders one or several children after generated primitives", () => {
    const { svg } = renderActivity(
      {},
      [
        createElement("circle", { key: "one", "data-child": "one" }),
        createElement("rect", { key: "two", "data-child": "two" }),
      ],
    );
    expect(svg.querySelectorAll("[data-child]").length).toBe(2);
    expect(svg.lastElementChild.getAttribute("data-child")).toBe("two");
  });

  test("duplicates visual props onto generated children for OTA updates", () => {
    const { svg } = renderActivity({ fill: "red", color: "white", strokeWidth: 10 });
    for (const child of svg.children) {
      expect(child.getAttribute("fill")).toBe("red");
      expect(child.getAttribute("stroke")).toBe("white");
      expect(child.getAttribute("stroke-width")).toBe("10");
    }
  });

  test("Icon supports every generated primitive and createVadivamIcon", () => {
    const iconNode = [
      ["circle", { cx: "12", cy: "12", r: "2", key: "circle" }],
      ["ellipse", { cx: "12", cy: "12", rx: "3", ry: "2", key: "ellipse" }],
      ["line", { x1: "2", y1: "2", x2: "4", y2: "4", key: "line" }],
      ["path", { d: "M2 2h2", key: "path" }],
      ["polygon", { points: "2 2 4 4", key: "polygon" }],
      ["polyline", { points: "2 2 4 4", key: "polyline" }],
      ["rect", { x: "2", y: "2", width: "4", height: "4", key: "rect" }],
    ];
    const Custom = createVadivamIcon("custom-native", iconNode);
    expect(Custom.displayName).toBe("CustomNative");
    const { container } = render(createElement(Custom));
    for (const [tag] of iconNode) expect(container.querySelector(tag)).not.toBeNull();

    const direct = render(createElement(Icon, { iconNode }));
    expect(direct.container.querySelector("svg rect")).not.toBeNull();
  });
});
