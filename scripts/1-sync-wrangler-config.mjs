import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatedPath = path.join(
  root,
  "apps/docs/dist/server/wrangler.json",
);
const outputPath = path.join(root, "wrangler.jsonc");
const config = JSON.parse(await readFile(generatedPath, "utf8"));

for (const key of [
  "configPath",
  "userConfigPath",
  "topLevelName",
  "definedEnvironments",
]) {
  delete config[key];
}

const generatedDirectory = path.posix.dirname(
  path.posix.relative(root, generatedPath),
);
config.main = path.posix.join(generatedDirectory, config.main);
config.assets.directory = path.posix.normalize(
  path.posix.join(generatedDirectory, config.assets.directory),
);

await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`);
