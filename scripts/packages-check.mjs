import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { publishablePackages } from "./packages.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootVersion = JSON.parse(
  readFileSync(path.join(root, "package.json"), "utf8"),
).version;

function run(command, args, cwd, capture = false) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: capture ? "utf8" : undefined,
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.status !== 0) {
    if (capture) process.stderr.write(result.stderr ?? result.stdout ?? "");
    throw new Error(`${command} ${args.join(" ")} failed in ${cwd}`);
  }
  return result.stdout;
}

function getPackResult(packed, packageName) {
  const result = Array.isArray(packed)
    ? packed[0]
    : packed?.[packageName] ?? Object.values(packed ?? {})[0];
  if (!result || result.name !== packageName || !Array.isArray(result.files)) {
    throw new Error(`${packageName}: unexpected npm pack --json output`);
  }
  return result;
}

for (const { name, directory } of publishablePackages) {
  const cwd = path.join(root, directory);
  const manifest = JSON.parse(readFileSync(path.join(cwd, "package.json"), "utf8"));
  if (manifest.name !== name) throw new Error(`${directory}: expected name ${name}`);
  if (manifest.version !== rootVersion) {
    throw new Error(`${name}: version ${manifest.version} does not match ${rootVersion}`);
  }
  if (!existsSync(path.join(cwd, "dist"))) throw new Error(`${name}: missing dist`);
  run("bun", ["x", "publint", "."], cwd);
  const packed = JSON.parse(run("npm", ["pack", "--dry-run", "--json"], cwd, true));
  const packResult = getPackResult(packed, name);
  if (packResult.version !== rootVersion) {
    throw new Error(`${name}: tarball version ${packResult.version} does not match ${rootVersion}`);
  }
  const files = packResult.files.map(({ path: file }) => file);
  if (!files.some((file) => file.startsWith("dist/"))) {
    throw new Error(`${name}: npm tarball contains no dist files`);
  }
  if (!files.includes("README.md") || !files.includes("LICENSE")) {
    throw new Error(`${name}: npm tarball is missing README.md or LICENSE`);
  }
  console.log(`Validated ${name}@${rootVersion} (${files.length} files).`);
}
