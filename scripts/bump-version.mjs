import { readFile, writeFile } from "node:fs/promises";

const files = [
  "package.json",
  "packages/vadivam/package.json",
  "packages/vadivam-react/package.json",
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

process.stdout.write(next);
