import path from "node:path";
import { root as repoRoot } from "../../../scripts/lib/paths.mjs";

export { repoRoot };

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
