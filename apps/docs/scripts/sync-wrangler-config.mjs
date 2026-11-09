import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { docsPaths, repoRoot } from "./paths.mjs";

// Keys Wrangler writes into its generated config that only make sense next to
// that generated file; keeping them at the root would point back into dist.
export const GENERATED_ONLY_KEYS = [
  "configPath",
  "userConfigPath",
  "topLevelName",
  "definedEnvironments",
];

// Cloudflare Workers Builds and `bun run deploy` run `wrangler deploy` from
// the repository root, so the root config must mirror Blume's generated
// config with paths rewritten relative to the root.
export function toRootConfig(
  generated,
  { rootDir = repoRoot, generatedPath = docsPaths.generatedConfig, pathModule = path } = {},
) {
  const config = structuredClone(generated);
  for (const key of GENERATED_ONLY_KEYS) delete config[key];

  // Anchor relative paths to rootDir, never process.cwd().
  const generatedDirectory = pathModule.dirname(pathModule.resolve(rootDir, generatedPath));
  const toRootRelative = (target) =>
    pathModule
      .relative(rootDir, pathModule.resolve(generatedDirectory, target))
      .split(pathModule.sep)
      .join("/");

  if (typeof config.main !== "string") {
    throw new Error(`${generatedPath} is missing a "main" entry`);
  }
  config.main = toRootRelative(config.main);
  if (typeof config.assets?.directory === "string") {
    config.assets.directory = toRootRelative(config.assets.directory);
  }
  return config;
}

export async function syncWranglerConfig() {
  const generated = JSON.parse(await readFile(path.join(repoRoot, docsPaths.generatedConfig), "utf8"));
  const config = toRootConfig(generated);
  await writeFile(path.join(repoRoot, docsPaths.rootConfig), `${JSON.stringify(config, null, 2)}\n`);
  return config;
}
