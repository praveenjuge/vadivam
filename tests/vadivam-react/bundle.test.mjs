import { describe, expect, test } from "bun:test";
import { bundle } from "../helpers.mjs";

// tests/frameworks/bundle.test.mjs covers named imports, Icon, and
// createVadivamIcon for every package; these are React's own entries.
const policyBytes = (result) => result.bytesFrom(/vadivam-react\/dist\/runtimePolicy\.js$/);

describe("vadivam-react bundles", () => {
  test("named and per-icon subpath imports leave out the sanitizer", async () => {
    for (const source of [
      `import { Activity, Bell, House, Search, Settings } from "vadivam-react";\nexport const icons = [Activity, Bell, House, Search, Settings];\n`,
      `import Activity from "vadivam-react/activity";\nimport Bell from "vadivam-react/icons/bell";\nexport const icons = [Activity, Bell];\n`,
    ]) {
      expect(policyBytes(await bundle(source, { external: ["react"] }))).toBe(0);
    }
  });

  test("createIcon and DynamicIcon keep the sanitizer", async () => {
    for (const source of [`export { createIcon } from "vadivam-react";\n`, `export { DynamicIcon } from "vadivam-react/dynamic";\n`]) {
      expect(policyBytes(await bundle(source, { external: ["react"] }))).toBeGreaterThan(0);
    }
  });

  test("the runtime shared by built-in icons stays within its size budget", async () => {
    const { bytesFrom } = await bundle(`export { Activity } from "vadivam-react";\n`, { external: ["react"], minify: true });
    // About 5.2 KB minified while built-in icons carried the sanitizer; about
    // 1.8 KB without it.
    const runtime = bytesFrom(/vadivam-react\/dist\/(?!icons\/)/);
    expect(runtime).toBeGreaterThan(0);
    expect(runtime).toBeLessThan(2500);
  });
});
