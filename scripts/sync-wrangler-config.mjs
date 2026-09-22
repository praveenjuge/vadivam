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

const generatedDirectory = path.dirname(generatedPath);
const toRootRelative = (target) =>
  path
    .relative(root, path.resolve(generatedDirectory, target))
    .split(path.sep)
    .join("/");

config.main = toRootRelative(config.main);
config.assets.directory = toRootRelative(config.assets.directory);

await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`);
