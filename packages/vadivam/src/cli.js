#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { guideUrl, migrateLucide } from "./migrate-lucide.js";

const { version } = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const [command, ...rest] = process.argv.slice(2);
const usage = `vadivam ${version}

Usage:
  npx vadivam migrate-lucide [paths...] [--write]

Rewrites Lucide imports, identifiers, dependencies, data-lucide attributes, and
.lucide CSS classes to Vadivam. Without --write it only lists what would change.
Paths default to the current directory.

Guide: ${guideUrl}`;

if (command === "--version" || command === "-v") {
  console.log(version);
} else if (command !== "migrate-lucide" || rest.includes("--help") || rest.includes("-h")) {
  console.log(usage);
  // An unknown command is an error; asking for help is not.
  if (command && command !== "migrate-lucide" && command !== "--help" && command !== "-h") process.exitCode = 1;
} else {
  const write = rest.includes("--write");
  const targets = rest.filter((arg) => !arg.startsWith("-"));
  const files = await migrateLucide(targets.length > 0 ? targets : ["."], { write, version });
  const changed = files.filter((entry) => entry.changes > 0);
  for (const { file, changes, warnings } of files) {
    const relative = path.relative(process.cwd(), file) || file;
    if (changes > 0) console.log(`${write ? "updated" : "would update"} ${relative} (${changes} change${changes === 1 ? "" : "s"})`);
    for (const warning of warnings) console.log(`  check ${relative}: ${warning}`);
  }
  const warningCount = files.reduce((total, entry) => total + entry.warnings.length, 0);
  if (files.length === 0) {
    console.log("No Lucide usage found.");
  } else {
    console.log(
      `\n${changed.length} file${changed.length === 1 ? "" : "s"} ${write ? "updated" : "to update"}, ${warningCount} item${warningCount === 1 ? "" : "s"} to check by hand.`,
    );
    console.log(write ? "Reinstall dependencies with your package manager to update the lockfile." : "Run again with --write to apply.");
  }
}
