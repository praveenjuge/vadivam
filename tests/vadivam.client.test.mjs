import { describe, expect, spyOn, test } from "bun:test";
import { Activity, createElement, createIcons, icons } from "vadivam";

describe("vadivam browser API", () => {
  test("createElement renders a customizable SVG", () => {
    const svg = createElement(Activity, {
      width: 32,
      class: "custom",
      fill: "url(#trusted-paint)",
      onload: "alert(1)",
      href: "https://example.com",
      stroke: "url(https://example.com/paint.svg#x)",
      style: "background-image: image-set('https://example.com/track.png' 1x)",
      "aria-label": "Open URL(example)",
    });
    expect(svg.tagName.toLowerCase()).toBe("svg");
    expect(svg.getAttribute("width")).toBe("32");
    expect(svg.getAttribute("class")).toBe("custom");
    expect(svg.getAttribute("fill")).toBe("url(#trusted-paint)");
    expect(svg.getAttribute("onload")).toBeNull();
    expect(svg.getAttribute("href")).toBeNull();
    expect(svg.getAttribute("stroke")).toBe("currentColor");
    expect(svg.getAttribute("style")).toBeNull();
    expect(svg.getAttribute("aria-label")).toBe("Open URL(example)");
    expect(svg.querySelector("path")).not.toBeNull();
    expect(svg.querySelector("path").getAttribute("key")).toBeNull();
  });

  test("createElement keeps safe recursive geometry and removes executable SVG", () => {
    const svg = createElement([
      ["rect", { x: 2, y: 2, width: 20, height: 20, rx: 2, "data-part": "frame" }, [
        ["path", { d: "M4 12h16", stroke: "navy", onclick: "alert(1)", fill: "url(https://example.com/p.svg#x)" }],
        ["script", { href: "https://example.com/x.js" }],
      ]],
      ["animate", { attributeName: "href", values: "javascript:alert(1)" }],
      ["image", { href: "javascript:alert(1)" }],
      ["path", { d: "M2 4h2", 'bad" onload': "alert(1)", ".innerHTML": "<script>alert(1)</script>", "prop:innerHTML": "<script>alert(1)</script>" }],
    ], {
      width: 32,
      "aria-label": "Safe custom icon",
      innerHTML: "<script>alert(1)</script>",
      onload: "alert(1)",
      srcdoc: "<script>alert(1)</script>",
    });

    expect(svg.querySelectorAll("rect, path")).toHaveLength(3);
    expect(svg.querySelector("rect").getAttribute("data-part")).toBe("frame");
    expect(svg.querySelector("path").getAttribute("stroke")).toBe("navy");
    expect(svg.querySelector("path").getAttribute("onclick")).toBeNull();
    expect(svg.querySelector("path").getAttribute("fill")).toBeNull();
    expect(svg.querySelector("script, animate, image")).toBeNull();
    expect(svg.getAttribute("aria-label")).toBe("Safe custom icon");
    expect(svg.getAttribute("onload")).toBeNull();
    expect(svg.getAttribute("srcdoc")).toBeNull();
    expect(svg.innerHTML).not.toContain("alert(1)");
  });

  test("createElement safely bounds cyclic and deeply nested custom data", () => {
    const cyclicChildren = [];
    cyclicChildren.push(["rect", { x: 2, y: 2, width: 20, height: 20 }, cyclicChildren]);

    let deepChildren = [["path", { d: "M2 2h2" }]];
    for (let depth = 0; depth < 100; depth += 1) {
      deepChildren = [["rect", { x: 2, y: 2, width: 20, height: 20 }, deepChildren]];
    }

    const cyclicSvg = createElement(cyclicChildren);
    const deepSvg = createElement(deepChildren);
    expect(cyclicSvg.querySelectorAll("rect")).toHaveLength(1);
    expect(deepSvg.querySelectorAll("rect").length).toBeLessThanOrEqual(33);
    expect(deepSvg.querySelector("path")).toBeNull();
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

  test("createIcons sanitizes poisoned registry entries and root attributes", () => {
    const root = document.createElement("div");
    root.innerHTML = '<i data-vadivam="poisoned" onload="alert(1)" href="javascript:alert(1)"></i>';
    createIcons({
      icons: {
        Poisoned: [
          ["script", { href: "https://example.com/x.js" }],
          ["path", { d: "M2 2h2", onclick: "alert(1)" }],
        ],
      },
      root,
      attrs: { innerHTML: "<script>alert(1)</script>" },
    });
    const svg = root.querySelector("svg");
    expect(svg.querySelector("path")).not.toBeNull();
    expect(svg.querySelector("script")).toBeNull();
    expect(svg.querySelector("[onclick]")).toBeNull();
    expect(svg.getAttribute("onload")).toBeNull();
    expect(svg.getAttribute("href")).toBeNull();
    expect(svg.innerHTML).not.toContain("alert(1)");
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
