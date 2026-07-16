import { describe, expect, test } from "bun:test";
import { h as preactH } from "preact";
import renderPreact from "preact-render-to-string";
import { createComponent as createSolidComponent } from "solid-js";
import { renderToString as renderSolid } from "solid-js/web";
import { createSSRApp, h as vueH } from "vue";
import { renderToString as renderVue } from "@vue/server-renderer";
import {
  Activity as PreactActivity,
  VadivamProvider as PreactProvider,
} from "../../packages/vadivam-preact/dist/index.js";
import {
  Activity as SolidActivity,
  VadivamProvider as SolidProvider,
} from "../../packages/vadivam-solid/dist/index.js";
import {
  Activity as VueActivity,
  VadivamProvider as VueProvider,
} from "../../packages/vadivam-vue/dist/index.js";

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
});
