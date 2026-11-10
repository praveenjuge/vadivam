// Checks that every file a version bump rewrites carries the release version.
// Usage: bun run release:validate v1.2.3 (or set TAG_NAME)
import { readFile } from "node:fs/promises";
import path from "node:path";
import { root } from "./lib/paths.mjs";
import { versionedFiles } from "./lib/release-versions.mjs";

const requested = process.argv[2] ?? process.env.TAG_NAME;
const expected = requested?.replace(/^v/, "");
if (!expected) throw new Error("Pass a release version or set TAG_NAME.");

let count = 0;
for (const [file, { read }] of versionedFiles) {
  for (const version of read(await readFile(path.join(root, file), "utf8"))) {
    if (version !== expected) throw new Error(`${file} version ${version} does not match ${requested}`);
    count += 1;
  }
}
console.log(`All ${count} release versions match v${expected}.`);
