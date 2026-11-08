// Decides whether a push changed anything the published packages are built
// from, so the release workflow only bumps versions when one did.
// Usage: bun scripts/release-changes.mjs <base> <head> (exits 1 when nothing did)
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Data the build reads besides the icons and the scripts it imports.
const buildData = [
  "metadata/lucide.json",
  "metadata/lucide-aliases.json",
  "metadata/lucide-rankings.json",
  "scripts/font-codepoints.json",
  "apps/docs/skills/vadivam-icons/SKILL.md",
];

/** Every script the build runs: the build command, the generators, and what they import. */
function buildScripts() {
  const pending = ["scripts/icons.mjs", ...readdirSync(path.join(root, "scripts/generators")).map((file) => `scripts/generators/${file}`)];
  const seen = new Set();
  while (pending.length) {
    const file = pending.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(path.join(root, file), "utf8");
    for (const [, specifier] of source.matchAll(/\bfrom\s+["'](\.{1,2}\/[^"'$]+)["']/g)) {
      const imported = path.posix.join(path.posix.dirname(file), specifier);
      // Generators also write import statements into the code they emit; only real files count.
      if (existsSync(path.join(root, imported))) pending.push(imported);
    }
  }
  return seen;
}

const packageInputs = new Set([...buildData, ...buildScripts()]);

export function isReleasablePath(file) {
  return (
    file.startsWith("icons/") ||
    file.startsWith("icons-solid/") ||
    file.startsWith("packages/") ||
    file.startsWith("apps/figma-plugin/") ||
    packageInputs.has(file)
  );
}

function releasablePaths(base, head) {
  const result = spawnSync("git", ["diff", "--name-only", base, head], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `Could not compare ${base} to ${head}`);
  }
  return result.stdout.split("\n").filter(Boolean).filter(isReleasablePath);
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
