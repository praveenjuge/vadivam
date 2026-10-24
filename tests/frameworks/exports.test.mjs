import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const iconManifest = JSON.parse(
  readFileSync(path.join(root, "packages/vadivam/dist/manifest.js"), "utf8")
    .match(/export const icons = ([\s\S]*);\nexport const iconNames/)[1],
);
const iconCount = iconManifest.length;

const importable = ["vue", "preact", "solid"];

describe("generated framework exports", () => {
  for (const framework of importable) {
    test(`${framework} exposes the complete static and dynamic API`, async () => {
      const dist = path.join(root, `packages/vadivam-${framework}/dist`);
      const api = await import(pathToFileURL(path.join(dist, "index.js")));
      const direct = await import(
        pathToFileURL(path.join(dist, "icons/activity.js"))
      );
      const dynamic = await import(
        pathToFileURL(path.join(dist, "dynamicIconImports.js"))
      );
      expect(api.Activity).toBeDefined();
      expect(api.ActivityIcon).toBe(api.Activity);
      expect(api.VadivamActivity).toBe(api.Activity);
      expect(api.Icon).toBeDefined();
      expect(api.createVadivamIcon).toBeFunction();
      expect(Object.keys(api.icons)).toHaveLength(iconCount);
      expect(direct.default).toBe(api.Activity);
      expect(direct.__iconNode.length).toBeGreaterThan(0);
      expect(dynamic.iconNames).toHaveLength(iconCount);
      expect((await dynamic.default.activity()).default).toBe(api.Activity);
    });
  }

  for (const framework of ["svelte", "astro"]) {
    test(`${framework} emits every public entrypoint`, async () => {
      const dist = path.join(root, `packages/vadivam-${framework}/dist`);
      const rootIndex = readFileSync(path.join(dist, "index.js"), "utf8");
      const extension = framework === "svelte" ? "svelte" : "astro";
      for (const { componentName, name } of iconManifest) {
        expect(existsSync(path.join(dist, `icons/${name}.${extension}`))).toBe(true);
        expect(existsSync(path.join(dist, `icons/${name}.${extension}.d.ts`))).toBe(true);
        expect(rootIndex).toContain(`default as ${componentName}`);
        expect(rootIndex).toContain(`default as ${componentName}Icon`);
        expect(rootIndex).toContain(`default as Vadivam${componentName}`);
      }
      const dynamic = await import(
        pathToFileURL(path.join(dist, "dynamicIconImports.js"))
      );
      expect(dynamic.iconNames).toHaveLength(iconCount);
      expect(Object.keys(dynamic.default)).toHaveLength(iconCount);
    });
  }

  for (const framework of importable) {
    test(`${framework} exposes the same API for solid icons under solid/`, async () => {
      const dist = path.join(root, `packages/vadivam-${framework}/dist`);
      const outline = await import(pathToFileURL(path.join(dist, "index.js")));
      const solid = await import(pathToFileURL(path.join(dist, "solid/index.js")));
      const dynamic = await import(pathToFileURL(path.join(dist, "solid/dynamicIconImports.js")));
      expect(solid.Activity).toBeDefined();
      expect(solid.Activity).not.toBe(outline.Activity);
      expect(solid.ActivityIcon).toBe(solid.Activity);
      expect(Object.keys(solid.icons)).toHaveLength(iconCount);
      expect(solid.VadivamProvider).toBe(outline.VadivamProvider);
      expect(dynamic.iconNames).toHaveLength(iconCount);
      expect((await dynamic.default.activity()).default).toBe(solid.Activity);
      const defaults = await import(pathToFileURL(path.join(dist, "solid/defaultAttributes.js")));
      expect(defaults.default.fill).toBe("currentColor");
      expect(defaults.default.stroke).toBeUndefined();
    });
  }

  for (const framework of ["svelte", "astro"]) {
    test(`${framework} emits every solid entrypoint`, async () => {
      const dist = path.join(root, `packages/vadivam-${framework}/dist/solid`);
      const solidIndex = readFileSync(path.join(dist, "index.js"), "utf8");
      const extension = framework === "svelte" ? "svelte" : "astro";
      for (const { componentName, name } of iconManifest) {
        expect(existsSync(path.join(dist, `icons/${name}.${extension}`))).toBe(true);
        expect(solidIndex).toContain(`default as ${componentName}`);
      }
      expect(readFileSync(path.join(dist, "defaultAttributes.js"), "utf8")).toContain('fill: "currentColor"');
    });
  }

  test("angular exposes solid directives as a secondary entry point", async () => {
    const dist = path.join(root, "packages/vadivam-angular/dist");
    await import("@angular/compiler");
    const outline = await import(pathToFileURL(path.join(dist, "fesm2022/vadivam-angular.mjs")));
    const solid = await import(pathToFileURL(path.join(dist, "fesm2022/vadivam-angular-solid.mjs")));
    expect(solid.Activity).toBeDefined();
    expect(solid.Activity).not.toBe(outline.Activity);
    expect(solid.ActivityIcon).toBe(solid.Activity);
    expect(solid.Icon).not.toBe(outline.Icon);
    expect(solid.provideVadivamConfig).toBe(outline.provideVadivamConfig);
    expect(Object.keys(solid.icons)).toHaveLength(iconCount);
    expect(solid.iconNames).toHaveLength(iconCount);
    for (const { name } of iconManifest) {
      expect(existsSync(path.join(dist, `solid/icons/${name}.js`))).toBe(true);
    }
  });

  test("angular exposes complete APF, registry, aliases, and dynamic entries", async () => {
    const dist = path.join(root, "packages/vadivam-angular/dist");
    await import("@angular/compiler");
    const api = await import(
      pathToFileURL(path.join(dist, "fesm2022/vadivam-angular.mjs"))
    );
    expect(api.Activity).toBeDefined();
    expect(api.ActivityIcon).toBe(api.Activity);
    expect(api.VadivamActivity).toBe(api.Activity);
    expect(api.Icon).toBeDefined();
    expect(api.DynamicIcon).toBeDefined();
    expect(api.createVadivamIcon).toBeFunction();
    expect(Object.keys(api.icons)).toHaveLength(iconCount);
    expect(api.iconNames).toHaveLength(iconCount);
    expect(Object.keys(api.dynamicIconImports)).toHaveLength(iconCount);
    for (const { name } of iconManifest) {
      expect(existsSync(path.join(dist, `icons/${name}.js`))).toBe(true);
      expect(existsSync(path.join(dist, `icons/${name}.d.ts`))).toBe(true);
    }
  });
});
