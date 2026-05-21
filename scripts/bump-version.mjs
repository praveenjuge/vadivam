import { readFile, writeFile } from "node:fs/promises";

const files = [
  "package.json",
  "packages/vadivam/package.json",
  "packages/vadivam-react/package.json",
];

const readmes = [
  "README.md",
  "packages/vadivam/README.md",
  "packages/vadivam-react/README.md",
];

const root = JSON.parse(await readFile(files[0], "utf8"));
const parts = root.version.split(".").map(Number);
if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
  throw new Error(`Unsupported version "${root.version}" in package.json`);
}
const [major, minor, patch] = parts;
const next = `${major}.${minor}.${patch + 1}`;

for (const file of files) {
  const pkg = JSON.parse(await readFile(file, "utf8"));
  pkg.version = next;
  await writeFile(file, `${JSON.stringify(pkg, null, 2)}\n`);
}

// Bust GitHub Camo and npm README image caches by versioning the preview URL.
const previewPattern = /preview\.png(?:\?v=[^)\s"']+)?/g;
for (const file of readmes) {
  const original = await readFile(file, "utf8");
  const updated = original.replace(previewPattern, `preview.png?v=${next}`);
  if (updated !== original) await writeFile(file, updated);
}

process.stdout.write(next);
