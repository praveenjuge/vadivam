import { describe, expect, test } from "bun:test";
import {
  Activity,
  categories,
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

  test("ships Lucide tags and categories in the manifest", () => {
    const categoryIds = new Set(categories.map((category) => category.id));
    expect(categories.find((category) => category.id === "arrows")?.title).toBe("Arrows");
    expect(iconsByName.activity.tags).toContain("pulse");
    for (const icon of manifest) {
      expect(icon.categories.length).toBeGreaterThan(0);
      for (const id of icon.categories) expect(categoryIds.has(id)).toBe(true);
    }
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
