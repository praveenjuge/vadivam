import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const GENERATED_CONFIG = "apps/docs/dist/server/wrangler.json";
export const ROOT_CONFIG = "wrangler.jsonc";

// Keys Wrangler writes into its generated config that only make sense next to
// that generated file; keeping them at the root would point back into dist.
export const GENERATED_ONLY_KEYS = [
  "configPath",
  "userConfigPath",
  "topLevelName",
  "definedEnvironments",
];

// Cloudflare Workers Builds runs `npx wrangler deploy` from the repository
// root, so the root config must mirror Blume's generated config with paths
// rewritten relative to the root.
export function toRootConfig(
  generated,
  { rootDir = root, generatedPath, pathModule = path } = {},
) {
  const config = structuredClone(generated);
  for (const key of GENERATED_ONLY_KEYS) delete config[key];

  const generatedFile =
    generatedPath ?? pathModule.join(rootDir, GENERATED_CONFIG);
  const generatedDirectory = pathModule.dirname(generatedFile);
  const toRootRelative = (target) =>
    pathModule
      .relative(rootDir, pathModule.resolve(generatedDirectory, target))
      .split(pathModule.sep)
      .join("/");

  if (typeof config.main !== "string") {
    throw new Error(`${GENERATED_CONFIG} is missing a "main" entry`);
  }
  config.main = toRootRelative(config.main);
  if (typeof config.assets?.directory === "string") {
    config.assets.directory = toRootRelative(config.assets.directory);
  }
  return config;
}

export async function syncWranglerConfig(rootDir = root) {
  const generatedPath = path.join(rootDir, GENERATED_CONFIG);
  const generated = JSON.parse(await readFile(generatedPath, "utf8"));
  const config = toRootConfig(generated, { rootDir, generatedPath });
  await writeFile(
    path.join(rootDir, ROOT_CONFIG),
    `${JSON.stringify(config, null, 2)}\n`,
  );
  return config;
}

if (import.meta.main) await syncWranglerConfig();
