import { describe, expect, test } from "bun:test";
import { icons, iconsByName, iconNames } from "vadivam";

describe("vadivam package", () => {
  test("exports a complete manifest", () => {
    expect(icons.length).toBeGreaterThan(0);
    expect(iconNames).toHaveLength(icons.length);
    expect(iconsByName.activity.componentName).toBe("Activity");
  });

  test("resolves raw SVG subpath exports", () => {
    const resolvedSvg = import.meta.resolve("vadivam/icons/activity.svg");
    expect(resolvedSvg).toEndWith("/packages/vadivam/dist/icons/activity.svg");
  });
});
