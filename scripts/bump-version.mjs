// Bumps the patch version of every versioned file and prints the new version.
// With --list, prints the files a bump rewrites instead, for `git add`.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mcpServerManifest, nativePackages, npmPackages, releaseManifests } from "./packages.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readmes = ["README.md", ...[...npmPackages, ...nativePackages].map(({ directory }) => `${directory}/README.md`)];
const releaseFiles = [
  ...releaseManifests,
  ...nativePackages.map(({ versionFile }) => versionFile),
  mcpServerManifest,
  "bun.lock",
  ...readmes,
];

if (process.argv.includes("--list")) {
  process.stdout.write(`${releaseFiles.join("\n")}\n`);
  process.exit(0);
}

const read = (file) => readFile(path.join(root, file), "utf8");
const write = (file, contents) => writeFile(path.join(root, file), contents);

const parts = JSON.parse(await read("package.json")).version.split(".").map(Number);
if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
  throw new Error(`Unsupported version "${parts.join(".")}" in package.json`);
}
const [major, minor, patch] = parts;
const next = `${major}.${minor}.${patch + 1}`;

let lockfile = await read("bun.lock");
for (const file of releaseManifests) {
  const pkg = JSON.parse(await read(file));
  pkg.version = next;
  await write(file, `${JSON.stringify(pkg, null, 2)}\n`);
  // bun.lock records each workspace's version under its directory.
  const workspace = path.dirname(file) === "." ? "" : path.dirname(file);
  const entry = new RegExp(`("${workspace}": \\{\\n\\s*"name": "[^"]*",\\n\\s*"version": )"[^"]*"`);
  if (workspace) lockfile = lockfile.replace(entry, `$1"${next}"`);
}
await write("bun.lock", lockfile);

for (const { versionFile, versionPattern, versionLine } of nativePackages) {
  const original = await read(versionFile);
  if (!versionPattern.test(original)) throw new Error(`${versionFile} has no version line`);
  await write(versionFile, original.replace(versionPattern, versionLine(next)));
}

const server = JSON.parse(await read(mcpServerManifest));
server.version = next;
for (const entry of server.packages) entry.version = next;
await write(mcpServerManifest, `${JSON.stringify(server, null, 2)}\n`);

// Bust GitHub Camo and npm README image caches by versioning the preview URL,
// and keep the Gradle coordinate in the Compose README current.
const previewPattern = /preview\.png(?:\?v=[^)\s"']+)?/g;
const gradlePattern = /vadivam-compose:\d+\.\d+\.\d+/g;
for (const file of readmes) {
  const original = await read(file);
  const updated = original
    .replace(previewPattern, `preview.png?v=${next}`)
    .replace(gradlePattern, `vadivam-compose:${next}`);
  if (updated !== original) await write(file, updated);
}

process.stdout.write(next);
