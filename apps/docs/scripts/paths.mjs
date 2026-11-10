import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

// Where the docs build reads and writes, relative to the repository root.
// Blume builds into dist/; the steps in build.mjs finish that output.
export const docsPaths = Object.freeze({
  docs: "apps/docs",
  blume: "apps/docs/node_modules/.bin/blume",
  public: "apps/docs/public",
  client: "apps/docs/dist/client",
  server: "apps/docs/dist/server",
  generatedConfig: "apps/docs/dist/server/wrangler.json",
  workerSource: "apps/docs/worker/index.mjs",
  rootConfig: "wrangler.jsonc",
});

export const fromRoot = (relative) => path.join(repoRoot, relative);
