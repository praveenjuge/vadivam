import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

// Bundles small apps against the built package, the way an app bundler would,
// with React left external.
const directory = mkdtempSync(path.join(import.meta.dir, ".bundle-"));
afterAll(() => rmSync(directory, { recursive: true, force: true }));

async function bundle(source, minify = false) {
  const entry = path.join(directory, `entry-${Bun.hash(source)}.jsx`);
  writeFileSync(entry, source);
  const result = await Bun.build({ entrypoints: [entry], external: ["react"], minify, target: "browser" });
  if (!result.success) throw new AggregateError(result.logs, "bundle failed");
  return result.outputs[0].text();
}

const fiveIcons = `import { Activity, Bell, House, Search, Settings } from "vadivam-react";\nexport const icons = [Activity, Bell, House, Search, Settings];\n`;
// Module markers the unminified bundle keeps for each file it includes.
const sanitizerModules = /vadivam-react\/dist\/(?:runtimePolicy|Icon|createIcon)\.js/;

describe("vadivam-react bundles", () => {
  test("named icon imports leave out the sanitizer", async () => {
    const code = await bundle(fiveIcons);
    expect(code).toContain("vadivam-react/dist/IconBase.js");
    expect(code).not.toMatch(sanitizerModules);
    expect(code).not.toContain("dangerouslySetInnerHTML");
  });

  test("per-icon subpath imports leave out the sanitizer", async () => {
    const code = await bundle(`import Activity from "vadivam-react/activity";\nimport Bell from "vadivam-react/icons/bell";\nexport const icons = [Activity, Bell];\n`);
    expect(code).not.toMatch(sanitizerModules);
  });

  test("Icon, createIcon and DynamicIcon keep the sanitizer", async () => {
    for (const source of [
      `export { Icon } from "vadivam-react";\n`,
      `export { createIcon } from "vadivam-react";\n`,
      `export { DynamicIcon } from "vadivam-react/dynamic";\n`,
    ]) {
      expect(await bundle(source)).toContain("vadivam-react/dist/runtimePolicy.js");
    }
  });

  test("the runtime shared by built-in icons stays within its size budget", async () => {
    const defineIcon = path.resolve(import.meta.dir, "../../packages/vadivam-react/dist/defineIcon.js");
    const code = await bundle(`import { defineIcon } from ${JSON.stringify(defineIcon)};\nexport const Icon = defineIcon("x", "X", []);\n`, true);
    // About 5.2 KB minified (2.3 KB gzip) while built-in icons carried the
    // sanitizer; about 1.8 KB (0.9 KB gzip) without it.
    expect(code.length).toBeLessThan(2500);
    expect(gzipSync(code).length).toBeLessThan(1200);
  });
});
