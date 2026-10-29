import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mcpServerManifest, nativePackages, publishablePackages } from "./packages.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requested = process.argv[2] ?? process.env.TAG_NAME;
const expected = requested?.replace(/^v/, "");
if (!expected) throw new Error("Pass a release version or set TAG_NAME.");

const manifests = [
  { name: "vadivam-monorepo", directory: "." },
  ...publishablePackages,
  { name: "@vadivam/figma-plugin", directory: "apps/figma-plugin" },
];

for (const { name, directory } of manifests) {
  const manifestPath = path.join(root, directory, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.version !== expected) {
    throw new Error(
      `${name} version ${manifest.version} does not match ${requested}`,
    );
  }
}

for (const { name, versionFile, versionPattern } of nativePackages) {
  const version = (await readFile(path.join(root, versionFile), "utf8")).match(versionPattern)?.[1].trim();
  if (version !== expected) {
    throw new Error(`${name} version ${version} in ${versionFile} does not match ${requested}`);
  }
}

const server = JSON.parse(await readFile(path.join(root, mcpServerManifest), "utf8"));
for (const version of [server.version, ...server.packages.map((entry) => entry.version)]) {
  if (version !== expected) {
    throw new Error(`${mcpServerManifest} version ${version} does not match ${requested}`);
  }
}

console.log(`All ${manifests.length + nativePackages.length} versioned projects and the MCP server manifest match v${expected}.`);
