import { describe, expect, spyOn, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { Activity, Icon } from "vadivam-react";
import { DynamicIcon } from "vadivam-react/dynamic";

describe("createIcon server rendering", () => {
  test("renders valid svg markup with defaults", () => {
    const html = renderToStaticMarkup(createElement(Activity, null));
    expect(html.startsWith("<svg")).toBe(true);
    expect(html.includes("</svg>")).toBe(true);
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('fill="none"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('stroke-width="2"');
    expect(html).toContain('aria-hidden="true"');
  });

  test("does not log React warnings while rendering", () => {
    const errorSpy = spyOn(console, "error");
    renderToString(createElement(Activity, { size: 20, title: "Activity" }));
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test("reflects size, color and strokeWidth props", () => {
    const html = renderToStaticMarkup(
      createElement(Activity, { size: 40, color: "blue", strokeWidth: 1.5 })
    );
    expect(html).toContain('width="40"');
    expect(html).toContain('height="40"');
    expect(html).toContain('stroke="blue"');
    expect(html).toContain('stroke-width="1.5"');
  });

  test("absoluteStrokeWidth rescales during SSR", () => {
    const html = renderToStaticMarkup(
      createElement(Activity, { absoluteStrokeWidth: true, size: 48 })
    );
    expect(html).toContain('stroke-width="1"');
  });

  test("title renders a <title> and labels the icon", () => {
    const html = renderToStaticMarkup(createElement(Activity, { title: "Open" }));
    expect(html).toContain("<title>Open</title>");
    expect(html).toContain('role="img"');
    expect(html).not.toContain("aria-hidden");
  });

  test("does not serialize executable custom icon data or root props", () => {
    const html = renderToStaticMarkup(createElement(Icon, {
      iconNode: [
        ["script", { href: "https://example.com/x.js", key: "script" }],
        ["animate", { attributeName: "href", values: "javascript:alert(1)", key: "animate" }],
        ["path", { d: "M4 12h16", onclick: "alert(1)", key: "safe" }],
      ],
      onLoad: "alert(1)",
      dangerouslySetInnerHTML: { __html: "<script>alert(1)</script>" },
      href: "javascript:alert(1)",
    }));
    expect(html).toContain('<path d="M4 12h16"></path>');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<animate");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("onload");
    expect(html).not.toContain("href=");
    expect(html).not.toContain("alert(1)");
  });

  test("generated icons ignore an iconNode prop override during SSR", () => {
    const html = renderToStaticMarkup(createElement(Activity, {
      iconNode: [["script", { key: "script" }]],
    }));
    expect(html).toContain("<path");
    expect(html).not.toContain("<script");
  });

  test("DynamicIcon renders its fallback for a valid name during sync SSR", () => {
    // React.lazy does not resolve synchronously, so renderToStaticMarkup emits
    // the Suspense fallback rather than the resolved icon.
    const html = renderToStaticMarkup(
      createElement(DynamicIcon, {
        name: "activity",
        fallback: createElement("span", { "data-fallback": "true" }, "loading"),
      })
    );
    expect(html).toContain('data-fallback="true"');
    expect(html).toContain("loading");
  });

  test("DynamicIcon renders its fallback for an unknown name", () => {
    const html = renderToStaticMarkup(
      createElement(DynamicIcon, {
        name: "definitely-not-an-icon",
        fallback: createElement("span", { "data-fallback": "true" }, "missing"),
      })
    );
    expect(html).toContain('data-fallback="true"');
    expect(html).toContain("missing");
  });
});
