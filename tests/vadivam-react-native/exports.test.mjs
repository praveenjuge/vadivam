import "./mock.mjs";
import { describe, expect, test } from "bun:test";
import { readIcons } from "../../scripts/icon-source.mjs";
import { bundle } from "../helpers.mjs";

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

const iconAliases = (icon) => [icon.componentName, `${icon.componentName}Icon`, `Vadivam${icon.componentName}`];

describe("vadivam-react-native exports", () => {
  test("exports each icon under its three names and nothing unexpected", () => {
    const aliases = icons.flatMap(iconAliases);
    expect(Object.keys(named).sort()).toEqual([...NON_ICON_EXPORTS, ...aliases].sort());
    expect(Object.keys(iconsBarrel).sort()).toEqual(aliases.sort());
  });

  // Metro does not tree-shake, so a direct import must not reach an icon barrel.
  test("a direct icon import reaches no other icon", async () => {
    const { modules } = await bundle('export { default } from "vadivam-react-native/icons/activity";\n', {
      external: ["react", "react-native-svg"],
    });
    const reached = modules.filter((file) => file.includes("vadivam-react-native/dist/"));
    expect(reached.some((file) => file.endsWith("/icons/activity.js"))).toBe(true);
    expect(reached.filter((file) => /\/(?:icons\/(?!activity\.js$)|index\.js$)/.test(file))).toEqual([]);
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
      // React keys each element; the geometry is the icon's own.
      const keys = subpath.__iconNode.map(([, attrs]) => attrs.key);
      expect(new Set(keys).size).toBe(keys.length);
      expect(keys.every((key) => typeof key === "string" && key.length > 0)).toBe(true);
      expect(subpath.__iconNode.map(([tag, { key, ...attrs }]) => [tag, attrs])).toEqual(icon.iconNode);
    },
  );
});
