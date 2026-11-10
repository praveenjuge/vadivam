import { describe, expect, test } from "bun:test";
import { render } from "@lit-labs/ssr";
import { collectResult } from "@lit-labs/ssr/lib/render-result.js";
import * as lit from "vadivam-lit";
import LitDynamicIcon from "vadivam-lit/dynamic";
import * as litSolid from "vadivam-lit/solid";
import * as qwik from "vadivam-qwik";
import * as qwikSolid from "vadivam-qwik/solid";
import { iconNames } from "../../scripts/icon-source.mjs";
import { eventually, expectSafeIconMarkup, svgAttributes, unsafeIconNode } from "../helpers.mjs";

const names = await iconNames();

// Lit SSR output includes its hydration comments; assertions match around them.
const litMarkup = async (template) => collectResult(render(template));

// A Qwik JSX node's children as a flat list of nodes.
const childNodes = (node) => [node.children].flat(Infinity).filter(Boolean);

describe("vadivam-lit", () => {
  test("exposes every icon, aliases, and the dynamic map", () => {
    expect(Object.keys(lit.icons)).toHaveLength(names.length);
    expect(lit.iconNames).toEqual(names);
    expect(lit.ActivityIcon).toBe(lit.Activity);
    expect(lit.VadivamActivity).toBe(lit.Activity);
  });

  test("server-renders size, color, absolute stroke width, and a title", async () => {
    const html = await litMarkup(lit.Activity({ size: 48, color: "navy", strokeWidth: 2, absoluteStrokeWidth: true, label: "Activity <chart>", class: "app-icon" }));
    expect(svgAttributes(html)).toMatchObject({
      width: "48",
      height: "48",
      stroke: "navy",
      "stroke-width": "1",
      class: "vadivam vadivam-activity app-icon",
      role: "img",
      "aria-label": "Activity &lt;chart&gt;",
    });
    expect(html).toContain("<title>Activity &lt;chart&gt;</title>");
    expect(html).not.toContain("aria-hidden");
  });

  test("hides decorative icons and rejects external paint", async () => {
    const html = await litMarkup(lit.Activity({ color: "url(https://example.com/x)" }));
    expect(svgAttributes(html)).toMatchObject({ stroke: "currentColor", "aria-hidden": "true" });
  });

  test("Icon and createVadivamIcon sanitize custom nodes", async () => {
    const Custom = lit.createVadivamIcon("custom", unsafeIconNode);
    const html = await litMarkup(Custom());
    expect(html).toContain("vadivam-custom");
    expectSafeIconMarkup(html);
    const escaped = await litMarkup(lit.Icon({ iconNode: [["path", { d: 'M1 1"/><script>alert(1)</script>' }]] }));
    expect(escaped).not.toContain("<script>");
  });

  test("DynamicIcon renders the fallback for unknown names", () => {
    expect(LitDynamicIcon({ name: "not-an-icon", fallback: "none" })).toBe("none");
  });

  test("DynamicIcon shows the fallback until the icon loads, then renders it synchronously", async () => {
    expect(await litMarkup(LitDynamicIcon({ name: "activity", fallback: "loading" }))).toContain("loading");
    await eventually(async () => {
      const html = await litMarkup(LitDynamicIcon({ name: "activity", size: 20, fallback: "loading" }));
      expect(svgAttributes(html)).toMatchObject({ class: "vadivam vadivam-activity", width: "20" });
    });
  });
});

describe("vadivam-lit/solid", () => {
  test("exposes a solid twin of every icon", () => {
    expect(Object.keys(litSolid.icons)).toHaveLength(names.length);
    expect(litSolid.Activity).not.toBe(lit.Activity);
    expect(litSolid.ActivityIcon).toBe(litSolid.Activity);
  });

  test("fills with color and takes no stroke", async () => {
    const html = await litMarkup(litSolid.Activity({ size: 32, color: "navy", strokeWidth: 3, label: "Activity" }));
    expect(svgAttributes(html)).toMatchObject({ width: "32", height: "32", fill: "navy", "fill-rule": "evenodd" });
    expect(html).not.toContain("stroke");
    expect(html).toContain("vadivam-activity");
  });
});

describe("vadivam-qwik", () => {
  test("exposes every icon and aliases", () => {
    expect(Object.keys(qwik.icons)).toHaveLength(names.length);
    expect(qwik.ActivityIcon).toBe(qwik.Activity);
    expect(qwik.VadivamActivity).toBe(qwik.Activity);
  });

  test("renders Qwik JSX with size, color, stroke, title, and event QRL props", () => {
    const onClick$ = () => {};
    const node = qwik.Activity({ size: 48, color: "navy", absoluteStrokeWidth: true, title: "Activity chart", class: "app-icon", "data-custom": "yes", onload: "alert(1)", onClick$ });
    expect(node.type).toBe("svg");
    expect(node.props).toMatchObject({
      width: 48,
      stroke: "navy",
      "stroke-width": 1,
      class: ["vadivam", "vadivam-activity", "app-icon"],
      role: "img",
      "data-custom": "yes",
    });
    expect(node.props.onload).toBeUndefined();
    expect(node.props["aria-hidden"]).toBeUndefined();
    expect(Object.values(node.props)).toContain(onClick$);
    expect(childNodes(node).map((child) => child.type)).toEqual(["title", "path"]);
  });

  test("keeps Qwik's class forms and passes refs through", () => {
    expect(qwik.Activity({ class: { active: true } }).props.class).toEqual(["vadivam", "vadivam-activity", { active: true }]);
    expect(qwik.Activity({ class: ["a", "b"] }).props.class).toEqual(["vadivam", "vadivam-activity", ["a", "b"]]);
    const signalRef = { value: undefined };
    const callbackRef = () => {};
    expect(qwik.Activity({ ref: signalRef }).props.ref).toBe(signalRef);
    expect(qwik.Activity({ ref: callbackRef }).props.ref).toBe(callbackRef);
  });

  test("Icon sanitizes custom nodes and external paint", () => {
    const node = qwik.Icon({ iconNode: unsafeIconNode, color: "url(https://example.com/x)" });
    expect(node.props.stroke).toBe("currentColor");
    expect(node.props["aria-hidden"]).toBe("true");
    const children = childNodes(node);
    expect(children.map((child) => child.type)).toEqual(["path", "path"]);
    expect(children.map((child) => ({ ...child.props }))).toEqual([{ d: "M4 12h16", stroke: "navy" }, { d: "M2 4h2" }]);
  });
});

describe("vadivam-qwik/solid", () => {
  test("exposes a solid twin of every icon", () => {
    expect(Object.keys(qwikSolid.icons)).toHaveLength(names.length);
    expect(qwikSolid.Activity).not.toBe(qwik.Activity);
    expect(qwikSolid.ActivityIcon).toBe(qwikSolid.Activity);
  });

  test("fills with color and takes no stroke", () => {
    const { props } = qwikSolid.Activity({ size: 32, color: "navy", strokeWidth: 3, absoluteStrokeWidth: true });
    expect(props).toMatchObject({ width: 32, fill: "navy", "fill-rule": "evenodd" });
    expect(props.stroke).toBeUndefined();
    expect(props["stroke-width"]).toBeUndefined();
    expect(props.class).toEqual(["vadivam", "vadivam-activity", undefined]);
  });
});
