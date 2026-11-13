import { describe, expect, test } from "bun:test";
import { h as preactH } from "preact";
import renderPreact from "preact-render-to-string";
import { createComponent as createSolidComponent } from "solid-js";
import { renderToString as renderSolid } from "solid-js/web";
import { createSSRApp, h as vueH } from "vue";
import { renderToString as renderVue } from "vue/server-renderer";
import {
  Activity as PreactActivity,
  Icon as PreactIcon,
  VadivamProvider as PreactProvider,
} from "vadivam-preact";
import {
  Activity as SolidActivity,
  Icon as SolidIcon,
  VadivamProvider as SolidProvider,
} from "vadivam-solid";
import {
  Activity as VueActivity,
  Icon as VueIcon,
  VadivamProvider as VueProvider,
} from "vadivam-vue";
import { Activity as SolidPreactActivity } from "vadivam-preact/solid";
import { Activity as SolidSolidActivity } from "vadivam-solid/solid";
import { Activity as SolidVueActivity } from "vadivam-vue/solid";
import { expectSafeIconMarkup, svgAttributes, unsafeIconNode } from "../helpers.mjs";

function assertMarkup(markup) {
  expect(svgAttributes(markup)).toMatchObject({ width: "48", height: "48", stroke: "navy", "stroke-width": "1", role: "img" });
  expect(markup).toContain("vadivam-activity");
  expect(markup).toContain("Activity chart</title>");
  expect(markup).not.toContain("aria-hidden");
}

function assertSafeFallback(markup) {
  expect(svgAttributes(markup)).toMatchObject({ width: "0", "stroke-width": "3", "aria-hidden": "true" });
  expect(markup).not.toContain("Infinity");
  expect(markup).not.toContain("NaN");
}

describe("framework-native server rendering", () => {
  test("Vue renders provider defaults, title, and absolute stroke width", async () => {
    const app = createSSRApp({
      render: () =>
        vueH(VueProvider, { size: 48, color: "navy", strokeWidth: 2 }, () =>
          vueH(VueActivity, { absoluteStrokeWidth: true, title: "Activity chart" }),
        ),
    });
    assertMarkup(await renderVue(app));
  });

  test("Vue safely handles zero absolute size", async () => {
    const app = createSSRApp({
      render: () => vueH(VueActivity, { absoluteStrokeWidth: true, size: 0, strokeWidth: 3 }),
    });
    assertSafeFallback(await renderVue(app));
  });

  test("Vue casts a bare absolute-stroke-width attribute to true", async () => {
    // A template's bare `absolute-stroke-width` compiles to an empty string.
    const app = createSSRApp({
      render: () => vueH(VueActivity, { "absolute-stroke-width": "", size: 48 }),
    });
    expect(svgAttributes(await renderVue(app))["stroke-width"]).toBe("1");
  });

  test("Vue strips executable custom icon data during SSR", async () => {
    const app = createSSRApp({
      render: () => vueH(VueIcon, {
        iconNode: unsafeIconNode,
        color: "url(https://example.com/paint.svg#x)",
        onload: "alert(1)",
        innerHTML: "<script>alert(1)</script>",
        href: "javascript:alert(1)",
      }),
    });
    expectSafeIconMarkup(await renderVue(app));
  });

  test("Preact renders provider defaults, title, and absolute stroke width", () => {
    const markup = renderPreact(
      preactH(
        PreactProvider,
        { size: 48, color: "navy", strokeWidth: 2 },
        preactH(PreactActivity, {
          absoluteStrokeWidth: true,
          title: "Activity chart",
        }),
      ),
    );
    assertMarkup(markup);
  });

  test("Preact safely handles zero absolute size", () => {
    assertSafeFallback(renderPreact(preactH(PreactActivity, {
      absoluteStrokeWidth: true,
      size: 0,
      strokeWidth: 3,
    })));
  });

  test("Preact strips executable custom icon data during SSR", () => {
    expectSafeIconMarkup(renderPreact(preactH(PreactIcon, {
      iconNode: unsafeIconNode,
      color: "url(https://example.com/paint.svg#x)",
      onLoad: "alert(1)",
      dangerouslySetInnerHTML: { __html: "<script>alert(1)</script>" },
      href: "javascript:alert(1)",
    })));
  });

  test("Solid renders provider defaults, title, and absolute stroke width", () => {
    const markup = renderSolid(() =>
      createSolidComponent(SolidProvider, {
        size: 48,
        color: "navy",
        strokeWidth: 2,
        get children() {
          return createSolidComponent(SolidActivity, {
            absoluteStrokeWidth: true,
            title: "Activity chart",
          });
        },
      }),
    );
    assertMarkup(markup);
  });

  test("Solid safely handles zero absolute size", () => {
    assertSafeFallback(renderSolid(() => createSolidComponent(SolidActivity, {
      absoluteStrokeWidth: true,
      size: 0,
      strokeWidth: 3,
    })));
  });

  test("Solid strips executable custom icon data during SSR", () => {
    expectSafeIconMarkup(renderSolid(() => createSolidComponent(SolidIcon, {
      iconNode: unsafeIconNode,
      color: "url(https://example.com/paint.svg#x)",
      onload: "alert(1)",
      innerHTML: "<script>alert(1)</script>",
      href: "javascript:alert(1)",
    })));
  });

  test("solid icons paint a fill from the shared provider and drop stroke props", async () => {
    const markups = [
      await renderVue(createSSRApp({
        render: () => vueH(VueProvider, { size: 48, color: "navy", strokeWidth: 2 }, () =>
          vueH(SolidVueActivity, { absoluteStrokeWidth: true, title: "Activity chart" })),
      })),
      renderPreact(preactH(PreactProvider, { size: 48, color: "navy", strokeWidth: 2 },
        preactH(SolidPreactActivity, { absoluteStrokeWidth: true, title: "Activity chart" }))),
      renderSolid(() => createSolidComponent(SolidProvider, {
        size: 48,
        color: "navy",
        strokeWidth: 2,
        get children() {
          return createSolidComponent(SolidSolidActivity, { absoluteStrokeWidth: true, title: "Activity chart" });
        },
      })),
    ];
    for (const markup of markups) {
      expect(svgAttributes(markup)).toMatchObject({ width: "48", fill: "navy", "fill-rule": "evenodd" });
      expect(markup).not.toContain("stroke");
      expect(markup).toContain("Activity chart</title>");
    }
  });

  test("solid icons fill with currentColor by default", async () => {
    const markups = [
      await renderVue(createSSRApp({ render: () => vueH(SolidVueActivity) })),
      renderPreact(preactH(SolidPreactActivity)),
      renderSolid(() => createSolidComponent(SolidSolidActivity, {})),
    ];
    for (const markup of markups) {
      expect(svgAttributes(markup)).toMatchObject({ fill: "currentColor", "fill-rule": "evenodd" });
      expect(markup).not.toContain("stroke");
    }
  });
});

// Built-in icons render their build-checked nodes without the node sanitizer,
// but keep sanitizing root props and color. createVadivamIcon still renders
// through the fully sanitizing Icon, so it is the reference markup.
const builtInSample = ["activity", "a-arrow-down", "house", "search", "settings"];
const hostileProps = { color: "url(https://example.com/paint.svg#x)", onload: "alert(1)", innerHTML: "<script>alert(1)</script>", href: "javascript:alert(1)" };
const builtInPropSets = [
  {},
  { size: 32, color: "red", strokeWidth: 1.5 },
  { absoluteStrokeWidth: true, size: 48 },
  { title: "Open" },
  { "aria-label": "Open", class: "local vadivam local" },
  { width: undefined, fill: null, "data-x": "1" },
  hostileProps,
  { iconNode: unsafeIconNode },
];
const builtInRenderers = {
  Vue: {
    packageName: "vadivam-vue",
    render: (Component, props) => renderVue(createSSRApp({
      render: () => vueH(VueProvider, { size: 40, color: "url(https://example.com/x#y)" }, () => vueH(Component, props)),
    })),
  },
  Preact: {
    packageName: "vadivam-preact",
    render: (Component, props) => renderPreact(preactH(PreactProvider, { size: 40, color: "url(https://example.com/x#y)" }, preactH(Component, props))),
  },
  Solid: {
    packageName: "vadivam-solid",
    render: (Component, props) => renderSolid(() => createSolidComponent(SolidProvider, {
      size: 40,
      color: "url(https://example.com/x#y)",
      get children() {
        return createSolidComponent(Component, { ...props });
      },
    })),
  },
};

describe("built-in icon render path", () => {
  for (const [framework, { packageName, render }] of Object.entries(builtInRenderers)) {
    test(`${framework} built-in icons render the same markup as the sanitizing path`, async () => {
      const { createVadivamIcon } = await import(packageName);
      for (const name of builtInSample) {
        const { default: BuiltIn, __iconNode } = await import(`${packageName}/icons/${name}`);
        const Reference = createVadivamIcon(name, __iconNode);
        for (const props of builtInPropSets) {
          const markup = await render(BuiltIn, props);
          expect(markup).toBe(await render(Reference, props));
          expect(markup).toContain(`vadivam-${name}`);
        }
      }
    });

    test(`${framework} built-in icons still sanitize root props and color`, async () => {
      const { Activity } = await import(packageName);
      const markup = await render(Activity, hostileProps);
      expect(markup).toContain('stroke="currentColor"');
      expect(markup).not.toContain("onload");
      expect(markup).not.toContain("href=");
      expect(markup).not.toContain("<script");
      expect(markup).not.toContain("alert(1)");
    });
  }
});
