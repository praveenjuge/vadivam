import { describe, expect, spyOn, test } from "bun:test";
import { Activity, createElement, createIcons, icons } from "vadivam";

describe("vadivam browser API", () => {
  test("createElement renders a customizable SVG", () => {
    const svg = createElement(Activity, {
      width: 32,
      class: "custom",
      fill: "red",
      onload: "alert(1)",
      href: "https://example.com",
    });
    expect(svg.tagName.toLowerCase()).toBe("svg");
    expect(svg.getAttribute("width")).toBe("32");
    expect(svg.getAttribute("class")).toBe("custom");
    expect(svg.getAttribute("fill")).toBe("red");
    expect(svg.getAttribute("onload")).toBeNull();
    expect(svg.getAttribute("href")).toBeNull();
    expect(svg.querySelector("path")).not.toBeNull();
    expect(svg.querySelector("path").getAttribute("key")).toBeNull();
  });

  test("createIcons replaces matching elements and merges attributes", () => {
    const root = document.createElement("div");
    root.innerHTML = '<i data-vadivam="activity" class="existing" aria-label="Activity"></i>';
    createIcons({ icons: { Activity }, root, attrs: { class: "defaults", width: 40 } });
    const svg = root.querySelector("svg");
    expect(svg.getAttribute("data-vadivam")).toBe("activity");
    expect(svg.getAttribute("width")).toBe("40");
    expect(svg.getAttribute("class")).toBe("vadivam vadivam-activity existing defaults");
    expect(svg.getAttribute("aria-label")).toBe("Activity");
    expect(svg.getAttribute("aria-hidden")).toBeNull();
  });

  test("createIcons supports custom attributes, templates, and shadow roots", () => {
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = '<span data-icon="activity"></span><template><span data-icon="activity"></span></template>';
    createIcons({ icons, nameAttr: "data-icon", root: shadow, inTemplates: true });
    expect(shadow.querySelector("svg")).not.toBeNull();
    expect(shadow.querySelector("template").content.querySelector("svg")).not.toBeNull();
  });

  test("createIcons reports missing configuration and names", () => {
    expect(() => createIcons()).toThrow("provide an icons object");
    expect(() => createIcons({ icons, nameAttr: "] *" })).toThrow("invalid nameAttr");
    const root = document.createElement("div");
    root.innerHTML = '<i data-vadivam="missing"></i>';
    const warning = spyOn(console, "warn").mockImplementation(() => {});
    createIcons({ icons: { Activity }, root });
    expect(warning).toHaveBeenCalledTimes(1);
    expect(root.querySelector("i")).not.toBeNull();
    warning.mockRestore();
  });
});
