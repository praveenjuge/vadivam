import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

// Bundles small apps against the built packages, the way an app bundler would,
// with each framework left external.
const root = path.resolve(import.meta.dir, "../..");
const directory = mkdtempSync(path.join(import.meta.dir, ".bundle-"));
afterAll(() => rmSync(directory, { recursive: true, force: true }));

async function bundle(source) {
  const entry = path.join(directory, `entry-${Bun.hash(source)}.js`);
  writeFileSync(entry, source);
  const result = await Bun.build({
    entrypoints: [entry],
    external: ["preact", "preact/*", "vue", "solid-js", "solid-js/*"],
    target: "browser",
  });
  if (!result.success) throw new AggregateError(result.logs, "bundle failed");
  return result.outputs[0].text();
}

const entry = (framework, file = "index.js") =>
  JSON.stringify(path.join(root, `packages/vadivam-${framework}/dist/${file}`));

describe("framework bundles", () => {
  for (const framework of ["preact", "vue", "solid"]) {
    test(`${framework} named icons keep the root sanitizer and leave out the node sanitizer`, async () => {
      const code = await bundle(`export { Activity, Bell, House, Search, Settings } from ${entry(framework)};\n`);
      expect(code).toContain("sanitizeRootAttributes");
      expect(code).not.toContain("SAFE_ICON_TAGS");
      expect(code).not.toContain("sanitizeIconNode");
    });

    test(`${framework} Icon and createVadivamIcon keep the node sanitizer`, async () => {
      for (const name of ["Icon", "createVadivamIcon"]) {
        const code = await bundle(`export { ${name} } from ${entry(framework)};\n`);
        expect(code).toContain("SAFE_ICON_TAGS");
      }
    });
  }
});
