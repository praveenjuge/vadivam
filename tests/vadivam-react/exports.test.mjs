import { describe, expect, test } from "bun:test";
import { readIcons } from "../../scripts/icons.mjs";
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

describe("vadivam-react exports", () => {
  test("exposes one named export per icon", () => {
    const iconExports = Object.keys(named).filter((key) => !NON_ICON_EXPORTS.has(key));
    expect(iconExports.length).toBe(icons.length * 3);
  });

  test("exposes one dynamic import per icon", () => {
    expect(Object.keys(dynamicIconImports).length).toBe(icons.length);
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
      expect(mod.__iconNode).toEqual(icon.iconNode);
    }
  );
});
