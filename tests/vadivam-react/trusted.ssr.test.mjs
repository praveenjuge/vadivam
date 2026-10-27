import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { VadivamProvider, createIcon } from "vadivam-react";
import dynamicIconImports from "vadivam-react/dynamicIconImports";

// Built-in icons render their build-validated nodes without the runtime
// sanitizer. createIcon still renders through the sanitizing Icon, the path
// every built-in icon used before, so it is the reference markup.
const names = Object.keys(dynamicIconImports);
const sample = [...new Set(["activity", "a-arrow-down", names.at(-1), ...names.filter((_, index) => index % 97 === 0)])];
const propSets = [
  {},
  { size: 32 },
  { size: "2em" },
  { color: "red" },
  { color: null },
  { strokeWidth: 1.5 },
  { absoluteStrokeWidth: true, size: 48 },
  { absoluteStrokeWidth: true, size: 0, strokeWidth: 3 },
  { title: "Open" },
  { "aria-label": "Open" },
  { "aria-label": undefined },
  { role: "img" },
  { "aria-hidden": "false" },
  { className: "local vadivam local" },
  { width: undefined, stroke: null, style: undefined },
  { width: 10, fill: "blue", strokeLinecap: "square" },
  { style: { color: "red", opacity: 0.5 }, "data-x": "1", id: "a", tabIndex: -1 },
  { iconNode: [["path", { d: "M0 0h1", key: "override" }]] },
];
const providers = [null, { size: 40, color: "purple", strokeWidth: 1.5, absoluteStrokeWidth: true, className: "app vadivam" }];

function markup(Component, props, provider, children) {
  const icon = createElement(Component, props, children);
  return renderToStaticMarkup(provider ? createElement(VadivamProvider, provider, icon) : icon);
}

describe("built-in icon render path", () => {
  test.each(sample)("%s renders the same markup as the sanitizing path", async (name) => {
    const { default: BuiltIn, __iconNode } = await dynamicIconImports[name]();
    const Reference = createIcon(name, __iconNode);
    expect(BuiltIn.displayName).toBe(Reference.displayName);
    for (const props of propSets) {
      for (const provider of providers) {
        for (const children of [undefined, createElement("circle", { cx: 12, cy: 12, r: 2 })]) {
          const html = markup(BuiltIn, props, provider, children);
          expect(html).toBe(markup(Reference, props, provider, children));
          expect(html).toContain(`vadivam-${name}`);
        }
      }
    }
  });
});
