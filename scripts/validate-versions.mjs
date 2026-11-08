// Checks that every versioned file carries the release version.
// Usage: bun run release:validate v1.2.3 (or set TAG_NAME)
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mcpServerManifest, nativePackages, releaseManifests } from "./packages.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requested = process.argv[2] ?? process.env.TAG_NAME;
const expected = requested?.replace(/^v/, "");
if (!expected) throw new Error("Pass a release version or set TAG_NAME.");

const read = (file) => readFile(path.join(root, file), "utf8");
const versions = [
  ...(await Promise.all(releaseManifests.map(async (file) => [file, JSON.parse(await read(file)).version]))),
  ...(await Promise.all(
    nativePackages.map(async ({ versionFile, versionPattern }) => [versionFile, (await read(versionFile)).match(versionPattern)?.[1].trim()]),
  )),
];
const server = JSON.parse(await read(mcpServerManifest));
versions.push(...[server.version, ...server.packages.map((entry) => entry.version)].map((version) => [mcpServerManifest, version]));

for (const [file, version] of versions) {
  if (version !== expected) throw new Error(`${file} version ${version} does not match ${requested}`);
}
console.log(`All ${versions.length} release versions match v${expected}.`);
