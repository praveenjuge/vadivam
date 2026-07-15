import { describe, expect, test } from "bun:test";
import { createElement, createRef } from "react";
import { render } from "@testing-library/react";
import {
  Activity,
  Icon,
  VadivamProvider,
  createIcon,
  createVadivamIcon,
} from "vadivam-react";

// Render an icon and return its root <svg> element.
function renderIcon(props, children) {
  const { container } = render(createElement(Activity, props, children));
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("icon did not render an <svg>");
  return { svg, container };
}

describe("createIcon rendering (client)", () => {
  test("renders sensible defaults", () => {
    const { svg } = renderIcon();
    expect(svg.getAttribute("width")).toBe("24");
    expect(svg.getAttribute("height")).toBe("24");
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.getAttribute("fill")).toBe("none");
    expect(svg.getAttribute("stroke")).toBe("currentColor");
    expect(svg.getAttribute("stroke-width")).toBe("2");
    expect(svg.getAttribute("stroke-linecap")).toBe("round");
    expect(svg.getAttribute("stroke-linejoin")).toBe("round");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("role")).toBeNull();
    // The icon node geometry is present.
    expect(svg.querySelector("path")).not.toBeNull();
  });

  test("size accepts a number", () => {
    const { svg } = renderIcon({ size: 32 });
    expect(svg.getAttribute("width")).toBe("32");
    expect(svg.getAttribute("height")).toBe("32");
  });

  test("size accepts a string", () => {
    const { svg } = renderIcon({ size: "2em" });
    expect(svg.getAttribute("width")).toBe("2em");
    expect(svg.getAttribute("height")).toBe("2em");
  });

  test("color maps to stroke", () => {
    const { svg } = renderIcon({ color: "red" });
    expect(svg.getAttribute("stroke")).toBe("red");
  });

  test("strokeWidth is forwarded", () => {
    const { svg } = renderIcon({ strokeWidth: 1.5 });
    expect(svg.getAttribute("stroke-width")).toBe("1.5");
  });

  test("absoluteStrokeWidth rescales by size", () => {
    const { svg } = renderIcon({ absoluteStrokeWidth: true, size: 48 });
    // 2 * 24 / 48 = 1
    expect(svg.getAttribute("stroke-width")).toBe("1");
  });

  test("absoluteStrokeWidth at default size keeps strokeWidth", () => {
    const { svg } = renderIcon({ absoluteStrokeWidth: true });
    expect(svg.getAttribute("stroke-width")).toBe("2");
  });

  test("absoluteStrokeWidth with non-numeric size is not rescaled", () => {
    const { svg } = renderIcon({ absoluteStrokeWidth: true, size: "2em", strokeWidth: 3 });
    expect(svg.getAttribute("stroke-width")).toBe("3");
  });

  test("title renders a <title> and labels the icon", () => {
    const { svg } = renderIcon({ title: "Open" });
    const title = svg.querySelector("title");
    expect(title).not.toBeNull();
    expect(title.textContent).toBe("Open");
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-hidden")).toBeNull();
  });

  test("aria-label labels without rendering a <title>", () => {
    const { svg } = renderIcon({ "aria-label": "Open" });
    expect(svg.querySelector("title")).toBeNull();
    expect(svg.getAttribute("role")).toBeNull();
    expect(svg.getAttribute("aria-hidden")).toBeNull();
    expect(svg.getAttribute("aria-label")).toBe("Open");
  });

  test("className and data-* attributes pass through", () => {
    const { svg } = renderIcon({ className: "icon-x", "data-foo": "bar" });
    expect(svg.getAttribute("class")).toBe("vadivam vadivam-activity icon-x");
    expect(svg.getAttribute("data-foo")).toBe("bar");
  });

  test("rest props override computed attributes", () => {
    const { svg } = renderIcon({ "aria-hidden": "false" });
    expect(svg.getAttribute("aria-hidden")).toBe("false");
  });

  test("forwards ref to the svg element", () => {
    const ref = createRef();
    render(createElement(Activity, { ref }));
    expect(ref.current).not.toBeNull();
    expect(ref.current.tagName.toLowerCase()).toBe("svg");
  });

  test("renders children inside the svg", () => {
    const { svg } = renderIcon({}, createElement("circle", { cx: 12, cy: 12, r: 4, key: "c" }));
    expect(svg.querySelector("circle")).not.toBeNull();
    expect(svg.getAttribute("aria-hidden")).toBeNull();
  });

  test("createIcon builds a working component", () => {
    const Custom = createIcon("Custom", [["path", { d: "M4 12h16", key: "p" }]]);
    expect(Custom.displayName).toBe("Custom");
    const { container } = render(createElement(Custom, null));
    const path = container.querySelector("svg path");
    expect(path).not.toBeNull();
    expect(path.getAttribute("d")).toBe("M4 12h16");
  });

  test("createVadivamIcon is the canonical createIcon alias", () => {
    expect(createVadivamIcon).toBe(createIcon);
  });

  test("Icon renders an icon node directly", () => {
    const { container } = render(
      createElement(Icon, {
        iconNode: [["line", { x1: "2", y1: "12", x2: "22", y2: "12", key: "line" }]],
      })
    );
    expect(container.querySelector("svg line")).not.toBeNull();
  });

  test("VadivamProvider applies global defaults and merges classes", () => {
    const { container } = render(
      createElement(
        VadivamProvider,
        { size: 40, color: "purple", strokeWidth: 1.5, className: "app-icons" },
        createElement(Activity, { className: "local-icon" })
      )
    );
    const svg = container.querySelector("svg");
    expect(svg.getAttribute("width")).toBe("40");
    expect(svg.getAttribute("stroke")).toBe("purple");
    expect(svg.getAttribute("stroke-width")).toBe("1.5");
    expect(svg.getAttribute("class")).toBe("vadivam app-icons vadivam-activity local-icon");
  });

  test("local props override provider defaults", () => {
    const { container } = render(
      createElement(
        VadivamProvider,
        { size: 40, color: "purple" },
        createElement(Activity, { size: 18, color: "green" })
      )
    );
    const svg = container.querySelector("svg");
    expect(svg.getAttribute("width")).toBe("18");
    expect(svg.getAttribute("stroke")).toBe("green");
  });
});
