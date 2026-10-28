import { describe, expect, test } from "bun:test";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { h as preactH } from "preact";
import { createComponent as createSolidComponent } from "solid-js";
import { renderToString as renderSolid } from "solid-js/web";
import { createSSRApp, h as vueH } from "vue";
import { renderToString as renderVue } from "vue/server-renderer";
import {
  Activity as PreactActivity,
  Icon as PreactIcon,
  VadivamProvider as PreactProvider,
} from "../../packages/vadivam-preact/dist/index.js";
import {
  Activity as SolidActivity,
  Icon as SolidIcon,
  VadivamProvider as SolidProvider,
} from "../../packages/vadivam-solid/dist/index.js";
import {
  Activity as VueActivity,
  Icon as VueIcon,
  VadivamProvider as VueProvider,
} from "../../packages/vadivam-vue/dist/index.js";

const rootRequire = createRequire(import.meta.url);
const preactRequire = createRequire(rootRequire.resolve("preact"));
const preactRendererDirectory = path.resolve(
  path.dirname(preactRequire.resolve("preact-render-to-string")),
  "..",
);
const renderPreact = (
  await import(
    pathToFileURL(path.join(preactRendererDirectory, "dist/index.mjs"))
  )
).default;

function assertMarkup(markup) {
  expect(markup).toContain("<svg");
  expect(markup).toContain("width=\"48\"");
  expect(markup).toContain("height=\"48\"");
  expect(markup).toContain("stroke=\"navy\"");
  expect(markup).toContain("stroke-width=\"1\"");
  expect(markup).toContain("vadivam-activity");
  expect(markup).toContain("Activity chart</title>");
  expect(markup).toContain('role="img"');
  expect(markup).not.toContain("aria-hidden");
}

function assertSafeFallback(markup) {
  expect(markup).toContain('width="0"');
  expect(markup).toContain('stroke-width="3"');
  expect(markup).not.toContain("Infinity");
  expect(markup).not.toContain("NaN");
  expect(markup).toContain('aria-hidden="true"');
}

const unsafeIconNode = [
  ["script", { href: "https://example.com/x.js", key: "script" }],
  ["animate", { attributeName: "href", values: "javascript:alert(1)", key: "animate" }],
  ["image", { href: "javascript:alert(1)", key: "image" }],
  ["path", {
    d: "M4 12h16",
    stroke: "navy",
    onclick: "alert(1)",
    innerHTML: "<script>alert(1)</script>",
    key: "safe",
  }],
  ["path", {
    d: "M2 4h2",
    'bad" onload': "alert(1)",
    ".innerHTML": "<script>alert(1)</script>",
    "prop:innerHTML": "<script>alert(1)</script>",
    key: "malformed",
  }],
];

function assertSafeCustomIcon(markup) {
  expect(markup).toContain('stroke="currentColor"');
  expect(markup).toContain("<path");
  expect(markup).toContain('d="M4 12h16"');
  expect(markup).toContain('stroke="navy"');
  expect(markup).not.toContain("<script");
  expect(markup).not.toContain("<animate");
  expect(markup).not.toContain("<image");
  expect(markup).not.toContain("onclick");
  expect(markup).not.toContain("onload");
  expect(markup).not.toContain("href=");
  expect(markup).not.toContain("alert(1)");
  expect(markup).not.toContain("prop:innerHTML");
  expect(markup).not.toContain("bad&quot;");
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
    assertSafeCustomIcon(await renderVue(app));
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
    assertSafeCustomIcon(renderPreact(preactH(PreactIcon, {
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
    assertSafeCustomIcon(renderSolid(() => createSolidComponent(SolidIcon, {
      iconNode: unsafeIconNode,
      color: "url(https://example.com/paint.svg#x)",
      onload: "alert(1)",
      innerHTML: "<script>alert(1)</script>",
      href: "javascript:alert(1)",
    })));
  });
});

// Built-in icons render their build-checked nodes without the node sanitizer,
// but keep sanitizing root props and color. createVadivamIcon still renders
// through the fully sanitizing Icon, so it is the reference markup.
const builtInSample = ["activity", "a-arrow-down", "house", "search", "settings"];
const builtInPropSets = [
  {},
  { size: 32, color: "red", strokeWidth: 1.5 },
  { absoluteStrokeWidth: true, size: 48 },
  { title: "Open" },
  { "aria-label": "Open", class: "local vadivam local" },
  { width: undefined, fill: null, "data-x": "1" },
  { color: "url(https://example.com/paint.svg#x)", onload: "alert(1)", innerHTML: "<script>alert(1)</script>", href: "javascript:alert(1)" },
  { iconNode: unsafeIconNode },
];
const builtInRenderers = {
  Vue: {
    dist: "vue",
    render: (Component, props) => renderVue(createSSRApp({
      render: () => vueH(VueProvider, { size: 40, color: "url(https://example.com/x#y)" }, () => vueH(Component, props)),
    })),
  },
  Preact: {
    dist: "preact",
    render: (Component, props) => renderPreact(preactH(PreactProvider, { size: 40, color: "url(https://example.com/x#y)" }, preactH(Component, props))),
  },
  Solid: {
    dist: "solid",
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
  for (const [framework, { dist, render }] of Object.entries(builtInRenderers)) {
    test(`${framework} built-in icons render the same markup as the sanitizing path`, async () => {
      const directory = path.resolve(import.meta.dir, `../../packages/vadivam-${dist}/dist`);
      const { createVadivamIcon } = await import(pathToFileURL(path.join(directory, "index.js")));
      for (const name of builtInSample) {
        const { default: BuiltIn, __iconNode } = await import(pathToFileURL(path.join(directory, `icons/${name}.js`)));
        const Reference = createVadivamIcon(name, __iconNode);
        for (const props of builtInPropSets) {
          const markup = await render(BuiltIn, props);
          expect(markup).toBe(await render(Reference, props));
          expect(markup).toContain(`vadivam-${name}`);
        }
      }
    });

    test(`${framework} built-in icons still sanitize root props and color`, async () => {
      const directory = path.resolve(import.meta.dir, `../../packages/vadivam-${dist}/dist`);
      const { Activity } = await import(pathToFileURL(path.join(directory, "index.js")));
      const markup = await render(Activity, builtInPropSets.at(-2));
      expect(markup).toContain('stroke="currentColor"');
      expect(markup).not.toContain("onload");
      expect(markup).not.toContain("href=");
      expect(markup).not.toContain("<script");
      expect(markup).not.toContain("alert(1)");
    });
  }
});
