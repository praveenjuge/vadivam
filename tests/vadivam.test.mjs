import { describe, expect, test } from "bun:test";
import {
  Activity,
  createElement,
  createIcons,
  icons,
  iconsByName,
  iconNames,
  manifest,
} from "vadivam";

describe("vadivam package", () => {
  test("exports icon nodes and a complete manifest", () => {
    expect(icons.Activity).toBe(Activity);
    expect(Activity[0][1].key).toBeUndefined();
    expect(manifest.length).toBeGreaterThan(0);
    expect(iconNames).toHaveLength(manifest.length);
    expect(iconsByName.activity.componentName).toBe("Activity");
  });

  test("resolves raw SVG and icon-node subpath exports", async () => {
    const resolvedSvg = import.meta.resolve("vadivam/icons/activity.svg");
    expect(resolvedSvg).toEndWith("/packages/vadivam/dist/icons/activity.svg");
    const module = await import("vadivam/icons/activity");
    expect(module.default).toBe(Activity);
  });

  test("browser-only functions fail clearly without a DOM", () => {
    expect(() => createElement(Activity)).toThrow("browser environment");
    expect(() => createIcons({ icons })).toThrow("browser environment");
  });
});
