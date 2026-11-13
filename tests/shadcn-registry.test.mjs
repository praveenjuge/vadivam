import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { registryItemSchema, registrySchema } from "shadcn/schema";
import { icons } from "vadivam/manifest";
import { svgPathData } from "../scripts/icon-styles.mjs";
import { baseItemName, iconItem, registryItems } from "../scripts/generators/shadcn.mjs";
import { packageMetadata, siteUrl } from "../scripts/packages.mjs";
import { shadcnAddCommand } from "../scripts/snippets.mjs";
import { repoRoot, svgAttributes, tagAttributes } from "./helpers.mjs";

const registryDir = path.join(repoRoot, "apps/docs/public/r");
const readJson = (file) => JSON.parse(readFileSync(path.join(registryDir, file), "utf8"));
const baseUrl = `${siteUrl}/r/${baseItemName}.json`;

// Writes registry items' files the way the shadcn CLI installs them, under
// tests/ so "react" resolves, and imports each icon component.
const installed = mkdtempSync(path.join(import.meta.dir, ".shadcn-"));
afterAll(() => rmSync(installed, { recursive: true, force: true }));
async function installItems(directory, names) {
  const folder = path.join(installed, directory);
  mkdirSync(folder, { recursive: true });
  for (const name of [baseItemName, ...names]) {
    const [{ content }] = JSON.parse(readFileSync(path.join(registryDir, directory, `${name}.json`), "utf8")).files;
    writeFileSync(path.join(folder, `${name}.tsx`), content);
  }
  return (name) => import(path.join(folder, `${name}.tsx`));
}

describe("shadcn registry", () => {
  const index = readJson("registry.json");
  const files = readdirSync(registryDir).filter((file) => file.endsWith(".json")).sort();

  test("registry.json matches shadcn's registry schema", () => {
    expect(registrySchema.safeParse(index).error).toBeUndefined();
    expect(index.name).toBe("vadivam");
    expect(index.homepage).toBe(siteUrl);
  });

  test("lists the base item and exactly one item per icon", () => {
    const names = index.items.map(({ name }) => name);
    expect(names).toEqual([baseItemName, ...icons.map(({ name }) => name)]);
    expect(new Set(names).size).toBe(names.length);
    expect(files).toEqual(
      ["registry.json", ...names.map((name) => `${name}.json`)].sort(),
    );
  });

  test("registry.json files carry no inlined content", () => {
    for (const item of index.items) {
      expect(item.files.length).toBeGreaterThan(0);
      for (const file of item.files) expect(file).not.toHaveProperty("content");
    }
  });

  test("every item file matches shadcn's registry-item schema and the index", () => {
    for (const entry of index.items) {
      const item = readJson(`${entry.name}.json`);
      const parsed = registryItemSchema.safeParse(item);
      if (parsed.error) throw new Error(`${entry.name}: ${parsed.error.message}`);
      expect(item.$schema).toBe("https://ui.shadcn.com/schema/registry-item.json");
      const { $schema, files, ...rest } = item;
      expect(entry).toEqual({
        ...rest,
        files: files.map(({ content, ...file }) => file),
      });
      for (const file of files) {
        expect(file.content.length).toBeGreaterThan(0);
        expect(file.type).toBe("registry:component");
        expect(file.target).toBe(`@components/icons/${entry.name}.tsx`);
      }
    }
  });

  test("icon items carry metadata, docs, and the shared base component", () => {
    for (const icon of icons) {
      const item = readJson(`${icon.name}.json`);
      expect(item).toMatchObject({
        type: "registry:component",
        title: icon.componentName,
        author: `${packageMetadata.author} <${siteUrl}>`,
        registryDependencies: [baseUrl],
        categories: icon.categories,
        meta: { tags: icon.tags, lucide: icon.name },
        docs: `Preview and other formats: ${siteUrl}/icons/${icon.name}`,
      });
      expect(item).not.toHaveProperty("dependencies");
      expect(item.description).toStartWith(
        `${icon.componentName} icon from Vadivam, a 24px outline icon set.`,
      );
      for (const tag of icon.tags) expect(item.description).toContain(tag);
    }
  });

  test("every installed icon component renders the icon's geometry", async () => {
    const load = await installItems("", icons.map(({ name }) => name));
    for (const icon of icons) {
      const module = await load(icon.name);
      expect(module.default).toBe(module[icon.componentName]);
      expect(module[`${icon.componentName}Icon`]).toBe(module.default);
      const markup = renderToStaticMarkup(createElement(module.default));
      expect(svgAttributes(markup).class).toBe(`vadivam vadivam-${icon.name}`);
      expect(tagAttributes(markup, "path").map(({ d }) => d)).toEqual(svgPathData(icon.svg));
    }
  });

  test("an undefined aria-label leaves the icon decorative", async () => {
    const load = await installItems("", ["bell"]);
    const { default: Bell } = await load("bell");
    expect(svgAttributes(renderToStaticMarkup(createElement(Bell, { "aria-label": undefined })))["aria-hidden"]).toBe("true");
    const labelled = svgAttributes(renderToStaticMarkup(createElement(Bell, { "aria-label": "Alerts" })));
    expect(labelled["aria-hidden"]).toBeUndefined();
    expect(labelled["aria-label"]).toBe("Alerts");
  });

  test("the base item is self-contained React with no npm dependency", () => {
    const item = readJson(`${baseItemName}.json`);
    expect(item).not.toHaveProperty("registryDependencies");
    expect(item).not.toHaveProperty("dependencies");
    const [{ content }] = item.files;
    const imports = [...content.matchAll(/from "([^"]+)"/g)].map(([, from]) => from);
    expect(imports).toEqual(["react"]);
  });

  test("the add command points at a generated item", () => {
    expect(shadcnAddCommand("activity")).toBe(
      `npx shadcn@latest add ${siteUrl}/r/activity.json`,
    );
    expect(files).toContain("activity.json");
  });
});

describe("shadcn registry generator", () => {
  const activity = icons.find(({ name }) => name === "activity");
  const node = (attrs) => ({ ...activity, iconNode: [["path", attrs]] });

  test("points dependencies at the configured base URL", () => {
    expect(
      iconItem(activity, { baseUrl: "http://127.0.0.1:4000" }).registryDependencies,
    ).toEqual([`http://127.0.0.1:4000/r/${baseItemName}.json`]);
  });

  test("rejects attribute values that could escape JSX", () => {
    expect(() => iconItem(node({ d: 'M0 0" onLoad="x' }))).toThrow(/Unsafe path attribute/);
    expect(() => iconItem(node({ d: "M0 0{x}" }))).toThrow(/Unsafe path attribute/);
    expect(() => iconItem(node({ "on-load": "x" }))).toThrow(/Unsafe path attribute/);
  });

  test("accepts the <line> geometry attributes icons:check allows", () => {
    const item = iconItem({ ...activity, iconNode: [["line", { x1: "4", y1: "12", x2: "20", y2: "12" }]] });
    expect(item.files[0].content).toContain('<line x1="4" y1="12" x2="20" y2="12" />');
  });

  test("refuses icon names that collide with registry files", () => {
    for (const name of [baseItemName, "registry"]) {
      expect(() => registryItems([{ ...activity, name }])).toThrow(/collides/);
    }
  });
});

describe("solid shadcn registry", () => {
  const solidDir = path.join(registryDir, "solid");
  const readSolid = (file) => JSON.parse(readFileSync(path.join(solidDir, file), "utf8"));
  const index = readSolid("registry.json");

  test("is its own registry with one item per icon", () => {
    expect(registrySchema.safeParse(index).error).toBeUndefined();
    expect(index.name).toBe("vadivam-solid");
    expect(index.items.map(({ name }) => name)).toEqual([baseItemName, ...icons.map(({ name }) => name)]);
    expect(readdirSync(solidDir).sort()).toEqual(
      ["registry.json", ...index.items.map(({ name }) => `${name}.json`)].sort(),
    );
  });

  test("installs under components/icons/solid on the solid base", () => {
    for (const icon of icons) {
      const item = readSolid(`${icon.name}.json`);
      const parsed = registryItemSchema.safeParse(item);
      if (parsed.error) throw new Error(`${icon.name}: ${parsed.error.message}`);
      expect(item.registryDependencies).toEqual([`${siteUrl}/r/solid/${baseItemName}.json`]);
      expect(item.files[0].target).toBe(`@components/icons/solid/${icon.name}.tsx`);
    }
    expect(readSolid(`${baseItemName}.json`).files[0].target).toBe(`@components/icons/solid/${baseItemName}.tsx`);
  });

  test("every installed solid component fills the solid geometry", async () => {
    const load = await installItems("solid", icons.map(({ name }) => name));
    for (const icon of icons) {
      const markup = renderToStaticMarkup(createElement((await load(icon.name)).default));
      const root = svgAttributes(markup);
      expect(root).toMatchObject({ fill: "currentColor", "fill-rule": "evenodd" });
      expect(Object.keys(root).filter((name) => name.startsWith("stroke"))).toEqual([]);
      expect(tagAttributes(markup, "path")).toEqual(svgPathData(icon.solid.svg).map((d) => ({ d })));
    }
  });

  test("the solid add command points at a generated item", () => {
    expect(shadcnAddCommand("house", "solid")).toBe(`npx shadcn@latest add ${siteUrl}/r/solid/house.json`);
  });
});
