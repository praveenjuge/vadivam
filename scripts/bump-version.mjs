// Bumps the patch version of every versioned file and prints the new version.
// With --list, prints the files a bump rewrites instead, for `git add`.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { root } from "./lib/paths.mjs";
import { versionedFiles } from "./lib/release-versions.mjs";

if (process.argv.includes("--list")) {
  process.stdout.write(`${versionedFiles.map(([file]) => file).join("\n")}\n`);
  process.exit(0);
}

const read = (file) => readFile(path.join(root, file), "utf8");

const parts = JSON.parse(await read("package.json")).version.split(".").map(Number);
if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
  throw new Error(`Unsupported version "${parts.join(".")}" in package.json`);
}
const [major, minor, patch] = parts;
const next = `${major}.${minor}.${patch + 1}`;

for (const [file, { write }] of versionedFiles) {
  const original = await read(file);
  const updated = write(original, next);
  if (updated !== original) await writeFile(path.join(root, file), updated);
}

process.stdout.write(next);
