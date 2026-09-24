import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  GENERATED_CONFIG,
  GENERATED_ONLY_KEYS,
  ROOT_CONFIG,
  toRootConfig,
} from "../scripts/sync-wrangler-config.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const generated = {
  name: "vadivam",
  main: "blume-worker.mjs",
  configPath: "/repo/apps/docs/wrangler.jsonc",
  userConfigPath: "/repo/apps/docs/wrangler.jsonc",
  topLevelName: "vadivam",
  definedEnvironments: [],
  assets: { binding: "ASSETS", directory: "../client" },
  no_bundle: true,
};

describe("root wrangler config sync", () => {
  test("rewrites entry and assets paths relative to the repository root", () => {
    const config = toRootConfig(generated, { rootDir: "/repo" });
    expect(config.main).toBe("apps/docs/dist/server/blume-worker.mjs");
    expect(config.assets.directory).toBe("apps/docs/dist/client");
    expect(config.assets.binding).toBe("ASSETS");
    expect(config.no_bundle).toBe(true);
  });

  test("anchors a relative generated path to the root, not the cwd", () => {
    // Uses a non-default location so a cwd-anchored resolve would leak the
    // test runner's working directory into the output paths.
    const config = toRootConfig(generated, {
      rootDir: "/repo",
      generatedPath: "build/server/wrangler.json",
    });
    expect(config.main).toBe("build/server/blume-worker.mjs");
    expect(config.assets.directory).toBe("build/client");
  });

  test("drops generated-only metadata", () => {
    const config = toRootConfig(generated, { rootDir: "/repo" });
    for (const key of GENERATED_ONLY_KEYS) expect(config).not.toHaveProperty(key);
  });

  test("does not mutate the generated config", () => {
    const input = structuredClone(generated);
    toRootConfig(input, { rootDir: "/repo" });
    expect(input).toEqual(generated);
  });

  test("emits forward-slash paths on Windows", () => {
    const config = toRootConfig(generated, {
      rootDir: "C:\\repo",
      pathModule: path.win32,
    });
    expect(config.main).toBe("apps/docs/dist/server/blume-worker.mjs");
    expect(config.assets.directory).toBe("apps/docs/dist/client");
  });

  test("fails loudly when the generated config has no entry", () => {
    const { main, ...withoutMain } = generated;
    expect(() => toRootConfig(withoutMain, { rootDir: "/repo" })).toThrow(
      /missing a "main" entry/,
    );
  });

  test("committed root config matches the built docs Worker", () => {
    const rootConfig = JSON.parse(readFileSync(path.join(root, ROOT_CONFIG), "utf8"));
    for (const key of GENERATED_ONLY_KEYS) expect(rootConfig).not.toHaveProperty(key);
    expect(rootConfig.name).toBe("vadivam");
    expect(rootConfig.main).toBe("apps/docs/dist/server/blume-worker.mjs");
    expect(rootConfig.assets.directory).toBe("apps/docs/dist/client");

    const generatedPath = path.join(root, GENERATED_CONFIG);
    if (!existsSync(generatedPath)) return;
    const built = toRootConfig(JSON.parse(readFileSync(generatedPath, "utf8")));
    expect(rootConfig).toEqual(built);
    expect(existsSync(path.join(root, rootConfig.main))).toBe(true);
    expect(existsSync(path.join(root, rootConfig.assets.directory))).toBe(true);
  });
});
