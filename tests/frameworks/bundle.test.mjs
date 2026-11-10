import { describe, expect, test } from "bun:test";
import { frameworks } from "../../scripts/packages.mjs";
import { bundle } from "../helpers.mjs";

// Bun cannot bundle .svelte or .astro components without their compilers,
// Angular ships one FESM file per entry that a bundler does not split by
// export, and React Native draws only native primitives, so it ships no
// runtime policy to leave out.
const notBundled = new Set(["svelte", "astro", "angular", "react-native"]);
const bundled = frameworks.filter((target) => target.registry === "npm" && !notBundled.has(target.id));
const external = ["react", "react/*", "preact", "preact/*", "vue", "solid-js", "solid-js/*", "lit", "lit/*", "@qwik.dev/*"];
const policyBytes = (result) => result.bytesFrom(/\/runtimePolicy\.js$/);

describe("framework bundles", () => {
  for (const { packageName } of bundled) {
    test(`${packageName} named icons leave out the node sanitizer that Icon and createVadivamIcon keep`, async () => {
      const named = await bundle(`export { Activity, Bell, House, Search, Settings } from "${packageName}";\n`, { external });
      for (const name of ["Icon", "createVadivamIcon"]) {
        const sanitizing = await bundle(`export { ${name} } from "${packageName}";\n`, { external });
        expect(policyBytes(named)).toBeLessThan(policyBytes(sanitizing));
      }
    });
  }
});
