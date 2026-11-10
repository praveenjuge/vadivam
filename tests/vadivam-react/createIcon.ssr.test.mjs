import { describe, expect, spyOn, test } from "bun:test";
import { createElement } from "react";
import { renderToReadableStream, renderToStaticMarkup, renderToString } from "react-dom/server";
import { Activity, Icon } from "vadivam-react";
import { DynamicIcon } from "vadivam-react/dynamic";
import { expectSafeIconMarkup, svgAttributes, unsafeIconNode } from "../helpers.mjs";

// Streams the page and waits for every Suspense boundary, as a server that
// awaits lazy components would.
async function renderComplete(element) {
  const stream = await renderToReadableStream(element);
  await stream.allReady;
  return new Response(stream).text();
}

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
      iconNode: unsafeIconNode,
      onLoad: "alert(1)",
      dangerouslySetInnerHTML: { __html: "<script>alert(1)</script>" },
      href: "javascript:alert(1)",
      color: "url(https://example.com/stroke.svg#x)",
    }));
    expectSafeIconMarkup(html);
    expect(svgAttributes(html).stroke).toBe("currentColor");
  });

  test("generated icons ignore an iconNode prop override during SSR", () => {
    const html = renderToStaticMarkup(createElement(Activity, {
      iconNode: [["path", { d: "M0 0h1", key: "override" }]],
    }));
    expect(html).toContain("<path");
    expect(html).not.toContain("M0 0h1");
  });

  test("DynamicIcon renders the icon once its module loads", async () => {
    const html = await renderComplete(
      createElement(DynamicIcon, { name: "activity", size: 20, fallback: createElement("span", null, "loading") }),
    );
    expect(svgAttributes(html)).toMatchObject({ class: "vadivam vadivam-activity", width: "20" });
    expect(html).not.toContain("loading");
  });

  test("DynamicIcon renders its fallback for an unknown name", async () => {
    const html = await renderComplete(
      createElement(DynamicIcon, { name: "definitely-not-an-icon", fallback: createElement("span", null, "missing") }),
    );
    expect(html).toContain("missing");
    expect(html).not.toContain("<svg");
  });
});
