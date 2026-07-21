import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { publishablePackages } from "./packages.mjs";

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

console.log(`All ${manifests.length} versioned projects match v${expected}.`);
