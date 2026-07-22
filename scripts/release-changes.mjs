import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const exactPackageInputs = new Set([
  "scripts/font-codepoints.json",
  "scripts/icons.mjs",
  "scripts/packages.mjs",
]);

export function isReleasablePath(path) {
  return (
    path.startsWith("icons/") ||
    path.startsWith("packages/") ||
    path.startsWith("apps/figma-plugin/") ||
    path.startsWith("scripts/generators/") ||
    exactPackageInputs.has(path)
  );
}

export function changedPaths(base, head) {
  const result = spawnSync("git", ["diff", "--name-only", base, head], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `Could not compare ${base} to ${head}`);
  }
  return result.stdout.split("\n").filter(Boolean);
}

export function releasablePaths(base, head) {
  return changedPaths(base, head).filter(isReleasablePath);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [base, head] = process.argv.slice(2);
  if (!base || !head) throw new Error("Usage: bun scripts/release-changes.mjs <base> <head>");

  const paths = releasablePaths(base, head);
  if (paths.length === 0) {
    console.log(`No releasable changes between ${base} and ${head}.`);
    process.exitCode = 1;
  } else {
    console.log(`Releasable changes between ${base} and ${head}:\n${paths.join("\n")}`);
  }
}
