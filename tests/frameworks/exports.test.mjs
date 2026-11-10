import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { iconNames } from "../../scripts/icon-source.mjs";
import { pascalCase } from "../../scripts/icon-styles.mjs";
import { frameworks, targetsById } from "../../scripts/packages.mjs";

const names = await iconNames();
const resolve = (specifier) => Bun.resolveSync(specifier, import.meta.dir);
const packageName = (id) => targetsById[id].packageName;
const aliases = (name) => [pascalCase(name), `${pascalCase(name)}Icon`, `Vadivam${pascalCase(name)}`];
// The names a module exports, read without running it, for entries that
// import .svelte or .astro components only their compilers can load.
const exportedNames = (specifier) =>
  new Set(new Bun.Transpiler({ loader: "js" }).scan(readFileSync(resolve(specifier), "utf8")).exports);
// The declaration file a package's export map names for one icon subpath.
function iconTypes(name, subpath, icon) {
  const manifestPath = resolve(`${name}/package.json`);
  const { exports } = JSON.parse(readFileSync(manifestPath, "utf8"));
  return path.join(path.dirname(manifestPath), exports[subpath].types.replace("*", icon));
}

// How this file checks each npm framework package: plain ESM it can import,
// or component files a compiler loads. Angular gets its own checks below, and
// React, React Native, Lit, and Qwik have their own test files.
const importable = ["vue", "preact", "solid"];
const componentFiles = ["svelte", "astro"];
const testedElsewhere = ["angular", "react", "react-native", "lit", "qwik"];

describe("generated framework exports", () => {
  test("every npm framework package is checked", () => {
    const npmFrameworks = frameworks.filter((target) => target.registry === "npm").map((target) => target.id);
    expect([...importable, ...componentFiles, ...testedElsewhere].sort()).toEqual(npmFrameworks.sort());
  });

  for (const id of importable) {
    const name = packageName(id);

    test(`${name} exposes the complete static and dynamic API`, async () => {
      const api = await import(name);
      const direct = await import(`${name}/icons/activity`);
      const dynamic = await import(`${name}/dynamicIconImports`);
      expect(api.Activity).toBeDefined();
      expect(api.ActivityIcon).toBe(api.Activity);
      expect(api.VadivamActivity).toBe(api.Activity);
      expect(api.Icon).toBeDefined();
      expect(api.createVadivamIcon).toBeFunction();
      expect(Object.keys(api.icons)).toHaveLength(names.length);
      expect(direct.default).toBe(api.Activity);
      expect(direct.__iconNode.length).toBeGreaterThan(0);
      expect(dynamic.iconNames).toEqual(names);
      expect((await dynamic.default.activity()).default).toBe(api.Activity);
    });

    test(`${name} exposes the same API for solid icons under solid/`, async () => {
      const outline = await import(name);
      const solid = await import(`${name}/solid`);
      const dynamic = await import(`${name}/solid/dynamicIconImports`);
      expect(solid.Activity).toBeDefined();
      expect(solid.Activity).not.toBe(outline.Activity);
      expect(solid.ActivityIcon).toBe(solid.Activity);
      expect(Object.keys(solid.icons)).toHaveLength(names.length);
      expect(solid.VadivamProvider).toBe(outline.VadivamProvider);
      expect(dynamic.iconNames).toEqual(names);
      expect((await dynamic.default.activity()).default).toBe(solid.Activity);
    });
  }

  for (const id of componentFiles) {
    const name = packageName(id);

    for (const entry of ["", "/solid"]) {
      test(`${name}${entry} exports every icon under all three names and as a subpath`, async () => {
        const exported = exportedNames(`${name}${entry}`);
        for (const icon of names) {
          for (const alias of aliases(icon)) expect(exported.has(alias)).toBe(true);
          expect(existsSync(resolve(`${name}${entry}/icons/${icon}`))).toBe(true);
          expect(existsSync(iconTypes(name, `.${entry}/icons/*`, icon))).toBe(true);
        }
        const dynamic = await import(`${name}${entry}/dynamicIconImports`);
        expect(dynamic.iconNames).toEqual(names);
        expect(Object.keys(dynamic.default)).toEqual(names);
      });
    }
  }

  test("angular exposes complete APF, registry, aliases, and dynamic entries", async () => {
    await import("@angular/compiler");
    const api = await import("vadivam-angular");
    expect(api.Activity).toBeDefined();
    expect(api.ActivityIcon).toBe(api.Activity);
    expect(api.VadivamActivity).toBe(api.Activity);
    expect(api.Icon).toBeDefined();
    expect(api.DynamicIcon).toBeDefined();
    expect(api.createVadivamIcon).toBeFunction();
    expect(Object.keys(api.icons)).toHaveLength(names.length);
    expect(api.iconNames).toEqual(names);
    expect(Object.keys(api.dynamicIconImports)).toEqual(names);
    for (const icon of names) {
      expect(existsSync(resolve(`vadivam-angular/icons/${icon}`))).toBe(true);
      expect(existsSync(iconTypes("vadivam-angular", "./icons/*", icon))).toBe(true);
    }
  });

  test("angular exposes solid directives as a secondary entry point", async () => {
    await import("@angular/compiler");
    const outline = await import("vadivam-angular");
    const solid = await import("vadivam-angular/solid");
    expect(solid.Activity).toBeDefined();
    expect(solid.Activity).not.toBe(outline.Activity);
    expect(solid.ActivityIcon).toBe(solid.Activity);
    expect(solid.Icon).not.toBe(outline.Icon);
    expect(solid.provideVadivamConfig).toBe(outline.provideVadivamConfig);
    expect(Object.keys(solid.icons)).toHaveLength(names.length);
    expect(solid.iconNames).toEqual(names);
    for (const icon of names) expect(existsSync(resolve(`vadivam-angular/solid/icons/${icon}`))).toBe(true);
  });
});
