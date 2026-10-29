import { describe, expect, test } from "bun:test";
import { render } from "@lit-labs/ssr";
import { collectResult } from "@lit-labs/ssr/lib/render-result.js";
import * as lit from "../../packages/vadivam-lit/dist/index.js";
import LitDynamicIcon from "../../packages/vadivam-lit/dist/dynamic.js";
import * as litSolid from "../../packages/vadivam-lit/dist/solid/index.js";
import * as qwik from "../../packages/vadivam-qwik/dist/index.js";
import * as qwikSolid from "../../packages/vadivam-qwik/dist/solid/index.js";
import { iconNames } from "../../packages/vadivam/dist/manifest.js";

// Lit SSR output includes its hydration comments; assertions match around them.
const litMarkup = async (template) => collectResult(render(template));

const unsafeIconNode = [
  ["script", { href: "https://example.com/x.js" }],
  ["path", { d: "M2 2h20", onclick: "alert(1)", fill: "url(https://example.com/p.svg#x)" }],
];

describe("vadivam-lit", () => {
  test("exposes every icon, aliases, and the dynamic map", () => {
    expect(Object.keys(lit.icons)).toHaveLength(iconNames.length);
    expect(lit.iconNames).toHaveLength(iconNames.length);
    expect(lit.ActivityIcon).toBe(lit.Activity);
    expect(lit.VadivamActivity).toBe(lit.Activity);
  });

  test("server-renders size, color, absolute stroke width, and a title", async () => {
    const html = await litMarkup(lit.Activity({ size: 48, color: "navy", strokeWidth: 2, absoluteStrokeWidth: true, label: "Activity <chart>", class: "app-icon" }));
    expect(html).toContain('width="48" height="48"');
    expect(html).toContain('stroke="navy" stroke-width="1"');
    expect(html).toContain('class="vadivam vadivam-activity app-icon"');
    expect(html).toContain('role="img" aria-label="Activity &lt;chart&gt;"');
    expect(html).toContain("<title>Activity &lt;chart&gt;</title>");
    expect(html).not.toContain("aria-hidden");
  });

  test("hides decorative icons and rejects external paint", async () => {
    const html = await litMarkup(lit.Activity({ color: "url(https://example.com/x)" }));
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('aria-hidden="true"');
  });

  test("Icon and createVadivamIcon sanitize custom nodes", async () => {
    const Custom = lit.createVadivamIcon("custom", unsafeIconNode);
    const html = await litMarkup(Custom());
    expect(html).toContain('<path d="M2 2h20">');
    expect(html).toContain("vadivam-custom");
    expect(html).not.toContain("script");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("example.com");
    const escaped = await litMarkup(lit.Icon({ iconNode: [["path", { d: 'M1 1"/><script>alert(1)</script>' }]] }));
    expect(escaped).not.toContain("<script>");
  });

  test("DynamicIcon renders the fallback for unknown names", () => {
    expect(LitDynamicIcon({ name: "not-an-icon", fallback: "none" })).toBe("none");
  });

  test("DynamicIcon renders a loaded icon synchronously", async () => {
    const pending = LitDynamicIcon({ name: "activity" });
    expect(pending.values).toBeDefined();
    await import("../../packages/vadivam-lit/dist/icons/activity.js");
    await new Promise((resolve) => setTimeout(resolve, 0));
    const html = await litMarkup(LitDynamicIcon({ name: "activity", size: 20 }));
    expect(html).toContain("vadivam-activity");
    expect(html).toContain('width="20"');
  });
});

describe("vadivam-lit/solid", () => {
  test("exposes a solid twin of every icon", () => {
    expect(Object.keys(litSolid.icons)).toHaveLength(iconNames.length);
    expect(litSolid.Activity).not.toBe(lit.Activity);
    expect(litSolid.ActivityIcon).toBe(litSolid.Activity);
  });

  test("fills with color and takes no stroke", async () => {
    const html = await litMarkup(litSolid.Activity({ size: 32, color: "navy", strokeWidth: 3, label: "Activity" }));
    expect(html).toContain('width="32" height="32"');
    expect(html).toContain('fill="navy" fill-rule="evenodd"');
    expect(html).not.toContain("stroke");
    expect(html).toContain("vadivam-activity");
  });
});

describe("vadivam-qwik", () => {
  test("exposes every icon and aliases", () => {
    expect(Object.keys(qwik.icons)).toHaveLength(iconNames.length);
    expect(qwik.ActivityIcon).toBe(qwik.Activity);
    expect(qwik.VadivamActivity).toBe(qwik.Activity);
  });

  test("renders Qwik JSX with size, color, stroke, title, and event QRL props", () => {
    const onClick$ = () => {};
    const node = qwik.Activity({ size: 48, color: "navy", absoluteStrokeWidth: true, title: "Activity chart", class: "app-icon", "data-custom": "yes", onload: "alert(1)", onClick$ });
    expect(node.type).toBe("svg");
    const props = { ...node.constProps, ...node.varProps };
    expect(props.width).toBe(48);
    expect(props.stroke).toBe("navy");
    expect(props["stroke-width"]).toBe(1);
    expect(props.class).toEqual(["vadivam", "vadivam-activity", "app-icon"]);
    expect(props.role).toBe("img");
    expect(props["data-custom"]).toBe("yes");
    expect(props.onload).toBeUndefined();
    expect(props["aria-hidden"]).toBeUndefined();
    expect(Object.values(props)).toContain(onClick$);
    const children = [node.children].flat(Infinity).filter(Boolean);
    expect(children.map((child) => child.type)).toEqual(["title", "path"]);
  });

  test("keeps Qwik's class forms and passes refs through", () => {
    const props = (node) => ({ ...node.constProps, ...node.varProps });
    expect(props(qwik.Activity({ class: { active: true } })).class).toEqual(["vadivam", "vadivam-activity", { active: true }]);
    expect(props(qwik.Activity({ class: ["a", "b"] })).class).toEqual(["vadivam", "vadivam-activity", ["a", "b"]]);
    const signalRef = { value: undefined };
    const callbackRef = () => {};
    expect(props(qwik.Activity({ ref: signalRef })).ref).toBe(signalRef);
    expect(props(qwik.Activity({ ref: callbackRef })).ref).toBe(callbackRef);
  });

  test("Icon sanitizes custom nodes and external paint", () => {
    const node = qwik.Icon({ iconNode: unsafeIconNode, color: "url(https://example.com/x)" });
    const props = { ...node.constProps, ...node.varProps };
    expect(props.stroke).toBe("currentColor");
    expect(props["aria-hidden"]).toBe("true");
    const children = [node.children].flat(Infinity).filter(Boolean);
    expect(children.map((child) => child.type)).toEqual(["path"]);
    const pathProps = { ...children[0].constProps, ...children[0].varProps };
    expect(pathProps).toEqual({ d: "M2 2h20" });
  });
});

describe("vadivam-qwik/solid", () => {
  test("exposes a solid twin of every icon", () => {
    expect(Object.keys(qwikSolid.icons)).toHaveLength(iconNames.length);
    expect(qwikSolid.Activity).not.toBe(qwik.Activity);
    expect(qwikSolid.ActivityIcon).toBe(qwikSolid.Activity);
  });

  test("fills with color and takes no stroke", () => {
    const node = qwikSolid.Activity({ size: 32, color: "navy", strokeWidth: 3, absoluteStrokeWidth: true });
    const props = { ...node.constProps, ...node.varProps };
    expect(props.width).toBe(32);
    expect(props.fill).toBe("navy");
    expect(props["fill-rule"]).toBe("evenodd");
    expect(props.stroke).toBeUndefined();
    expect(props["stroke-width"]).toBeUndefined();
    expect(props.class).toEqual(["vadivam", "vadivam-activity", undefined]);
  });
});
