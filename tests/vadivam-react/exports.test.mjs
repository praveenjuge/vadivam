import { describe, expect, test } from "bun:test";
import { readIcons } from "../../scripts/icon-source.mjs";
import * as named from "vadivam-react";
import dynamicIconImports from "vadivam-react/dynamicIconImports";

const icons = await readIcons();
const NON_ICON_EXPORTS = new Set([
  "Icon",
  "VadivamProvider",
  "createIcon",
  "createVadivamIcon",
  "icons",
  "useVadivamContext",
]);

const iconAliases = (icon) => [icon.componentName, `${icon.componentName}Icon`, `Vadivam${icon.componentName}`];

describe("vadivam-react exports", () => {
  test("exports each icon under its three names and nothing unexpected", () => {
    expect(Object.keys(named).sort()).toEqual([...NON_ICON_EXPORTS, ...icons.flatMap(iconAliases)].sort());
  });

  test("exposes one dynamic import per icon", () => {
    expect(Object.keys(dynamicIconImports)).toEqual(icons.map((icon) => icon.name));
  });

  test.each(icons.map((icon) => [icon.name, icon]))(
    "%s is reachable through every entry point",
    async (_name, icon) => {
      // Named export from the package root.
      expect(named[icon.componentName].displayName).toBe(icon.componentName);
      expect(named[`${icon.componentName}Icon`]).toBe(named[icon.componentName]);
      expect(named[`Vadivam${icon.componentName}`]).toBe(named[icon.componentName]);
      expect(named.icons[icon.componentName]).toBe(named[icon.componentName]);

      // ./icons/* subpath export.
      const subpath = await import(`vadivam-react/icons/${icon.name}`);
      expect(subpath.default.displayName).toBe(icon.componentName);

      // ./* alias export.
      const alias = await import(`vadivam-react/${icon.name}`);
      expect(alias.default.displayName).toBe(icon.componentName);

      // Dynamic import map entry.
      const importer = dynamicIconImports[icon.name];
      expect(typeof importer).toBe("function");
      const mod = await importer();
      expect(mod.default.displayName).toBe(icon.componentName);
      // React keys each element; the geometry is the icon's own.
      const keys = mod.__iconNode.map(([, attrs]) => attrs.key);
      expect(new Set(keys).size).toBe(keys.length);
      expect(keys.every((key) => typeof key === "string" && key.length > 0)).toBe(true);
      expect(mod.__iconNode.map(([tag, { key, ...attrs }]) => [tag, attrs])).toEqual(icon.iconNode);
    }
  );
});
