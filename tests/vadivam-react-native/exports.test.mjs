import "./mock.mjs";
import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { readIcons } from "../../scripts/icons.mjs";

const named = await import("vadivam-react-native");
const iconsBarrel = await import("vadivam-react-native/icons");
const icons = await readIcons();
const NON_ICON_EXPORTS = new Set([
  "Icon",
  "VadivamProvider",
  "createVadivamIcon",
  "dynamicIconImports",
  "iconNames",
  "useVadivamContext",
]);

describe("vadivam-react-native exports", () => {
  test("exposes exactly three aliases per canonical icon", () => {
    const rootIconExports = Object.keys(named).filter((key) => !NON_ICON_EXPORTS.has(key));
    expect(rootIconExports.length).toBe(icons.length * 3);
    expect(Object.keys(iconsBarrel).length).toBe(icons.length * 3);
    expect("icons" in named).toBe(false);
    expect("DynamicIcon" in named).toBe(false);
  });

  test("direct icon modules do not import an icon barrel", async () => {
    const source = await readFile(
      new URL("../../packages/vadivam-react-native/dist/icons/activity.js", import.meta.url),
      "utf8",
    );
    expect(source).toContain('from "../createVadivamIcon.js"');
    expect(source).not.toContain("index.js");
  });

  test.each(icons.map((icon) => [icon.name, icon]))(
    "%s is reachable through every entry point",
    async (_name, icon) => {
      const component = named[icon.componentName];
      expect(component.displayName).toBe(icon.componentName);
      expect(named[`${icon.componentName}Icon`]).toBe(component);
      expect(named[`Vadivam${icon.componentName}`]).toBe(component);
      expect(iconsBarrel[icon.componentName]).toBe(component);

      const subpath = await import(`vadivam-react-native/icons/${icon.name}`);
      const alias = await import(`vadivam-react-native/${icon.name}`);
      expect(subpath.default.displayName).toBe(icon.componentName);
      expect(alias.default).toBe(subpath.default);
      expect(subpath.__iconNode).toEqual(icon.iconNode);
    },
  );
});
