import { describe, expect, test } from "bun:test";
import { createElement, createRef } from "react";
import { render, waitFor } from "@testing-library/react";
import { DynamicIcon, iconNames } from "vadivam-react/dynamic";

describe("DynamicIcon (client)", () => {
  test("exports all valid icon names", () => {
    expect(iconNames).toContain("activity");
  });

  test("shows the fallback, then resolves the icon", async () => {
    const { container } = render(
      createElement(DynamicIcon, {
        name: "activity",
        fallback: createElement("span", { "data-testid": "fb" }, "loading"),
      })
    );

    // Fallback is shown before the lazy import resolves.
    expect(container.querySelector('[data-testid="fb"]')).not.toBeNull();
    expect(container.querySelector("svg")).toBeNull();

    // The icon resolves and replaces the fallback.
    await waitFor(() => {
      expect(container.querySelector("svg")).not.toBeNull();
    });
    expect(container.querySelector('[data-testid="fb"]')).toBeNull();
  });

  test("renders the fallback for an unknown name and never an svg", async () => {
    const { container } = render(
      createElement(DynamicIcon, {
        name: "definitely-not-an-icon",
        fallback: createElement("span", { "data-testid": "fb" }, "missing"),
      })
    );
    expect(container.querySelector('[data-testid="fb"]')).not.toBeNull();
    // Give any pending microtasks a chance to flush; still no svg.
    await Promise.resolve();
    expect(container.querySelector("svg")).toBeNull();
  });

  test("forwards props to the resolved icon", async () => {
    const ref = createRef();
    const { container } = render(
      createElement(DynamicIcon, {
        name: "activity",
        size: 40,
        color: "blue",
        "data-dyn": "yes",
        fallback: null,
        ref,
      })
    );

    await waitFor(() => {
      expect(container.querySelector("svg")).not.toBeNull();
    });
    const svg = container.querySelector("svg");
    expect(svg.getAttribute("width")).toBe("40");
    expect(svg.getAttribute("stroke")).toBe("blue");
    expect(svg.getAttribute("data-dyn")).toBe("yes");
    expect(ref.current).toBe(svg);
  });

  test("keeps sanitizing root props and paint for runtime-loaded icons", async () => {
    const { container } = render(
      createElement(DynamicIcon, {
        name: "activity",
        fallback: null,
        href: "javascript:alert(1)",
        color: "url(https://example.com/stroke.svg#x)",
        fill: "url(https://example.com/paint.svg#x)",
        style: { color: "red", backgroundImage: "url(https://example.com/track.png)" },
        "data-dyn": "yes",
      })
    );
    await waitFor(() => {
      expect(container.querySelector("svg")).not.toBeNull();
    });
    const svg = container.querySelector("svg");
    expect(svg.getAttribute("href")).toBeNull();
    expect(svg.getAttribute("stroke")).toBe("currentColor");
    expect(svg.getAttribute("fill")).toBe("none");
    expect(svg.style.color).toBe("red");
    expect(svg.style.backgroundImage).toBe("");
    expect(svg.getAttribute("data-dyn")).toBe("yes");
  });

  test("renders the fallback for inherited object keys", () => {
    for (const name of ["constructor", "toString", "__proto__"]) {
      const { container, unmount } = render(
        createElement(DynamicIcon, { name, fallback: createElement("span", { "data-testid": "fb" }) })
      );
      expect(container.querySelector('[data-testid="fb"]')).not.toBeNull();
      unmount();
    }
  });
});
