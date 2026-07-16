import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { publishablePackages } from "./packages.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function npm(args, cwd = root) {
  return spawnSync("npm", args, { cwd, encoding: "utf8" });
}

function publishedVersion(name, version) {
  const result = npm(["view", `${name}@${version}`, "version", "--prefer-online"]);
  if (result.status === 0) return result.stdout.trim();
  if (/\bE404\b|404 Not Found/.test(result.stderr)) return null;
  throw new Error(`Could not query ${name}@${version}: ${result.stderr.trim()}`);
}

async function verify(name, version) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (publishedVersion(name, version) === version) return;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error(`${name}@${version} did not become visible on npm.`);
}

for (const { name, directory } of publishablePackages) {
  const cwd = path.join(root, directory);
  const manifest = JSON.parse(await readFile(path.join(cwd, "package.json"), "utf8"));
  const version = manifest.version;
  const existing = publishedVersion(name, version);
  if (existing === version) {
    console.log(`Already published: ${name}@${version}`);
    continue;
  }
  const result = npm(["publish", "--access", "public"], cwd);
  if (result.status !== 0) {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(`npm publish failed for ${name}@${version}`);
  }
  await verify(name, version);
  console.log(`Published: ${name}@${version}`);
}

console.log(`Confirmed ${publishablePackages.length} package versions on npm.`);
