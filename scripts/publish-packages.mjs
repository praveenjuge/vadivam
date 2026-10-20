import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { publishablePackages } from "./packages.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registry = "https://registry.npmjs.org";
// npm can take well over five minutes to serve a version it has accepted.
const verifyTimeoutMinutes = 30;
const verifyIntervalMs = 15_000;

async function isPublished(name, version) {
  const response = await fetch(`${registry}/${name}/${version}`, {
    headers: { accept: "application/json", "cache-control": "no-cache" },
  });
  if (response.ok) return true;
  if (response.status === 404) return false;
  throw new Error(`Could not query ${name}@${version}: HTTP ${response.status}`);
}

function publish(cwd) {
  return spawnSync("npm", ["publish", "--access", "public"], { cwd, encoding: "utf8" });
}

// A re-run can reach a version npm accepted earlier but does not serve yet.
function versionExists(result) {
  return /EPUBLISHCONFLICT|cannot publish over the previously published version/i.test(
    result.stderr,
  );
}

const pending = [];
const failed = [];

// Publish everything first so one slow package does not hold back the rest.
for (const { name, directory } of publishablePackages) {
  const cwd = path.join(root, directory);
  const { version } = JSON.parse(await readFile(path.join(cwd, "package.json"), "utf8"));
  // If the lookup fails, publish anyway: npm reports an existing version as a conflict.
  let published = false;
  try {
    published = await isPublished(name, version);
  } catch (error) {
    console.warn(error.message);
  }
  if (published) {
    console.log(`Already published: ${name}@${version}`);
    continue;
  }
  const result = publish(cwd);
  if (result.status === 0 || versionExists(result)) {
    console.log(`Submitted: ${name}@${version}`);
    pending.push({ name, version });
    continue;
  }
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  failed.push(`${name}@${version}`);
}

const deadline = Date.now() + verifyTimeoutMinutes * 60_000;
while (pending.length > 0) {
  for (const entry of [...pending]) {
    try {
      if (!(await isPublished(entry.name, entry.version))) continue;
    } catch (error) {
      console.warn(error.message);
      continue;
    }
    pending.splice(pending.indexOf(entry), 1);
    console.log(`Published: ${entry.name}@${entry.version}`);
  }
  if (pending.length === 0 || Date.now() >= deadline) break;
  await new Promise((resolve) => setTimeout(resolve, verifyIntervalMs));
}

const problems = [];
if (failed.length > 0) problems.push(`npm publish failed for ${failed.join(", ")}.`);
if (pending.length > 0) {
  const names = pending.map(({ name, version }) => `${name}@${version}`).join(", ");
  problems.push(`${names} did not become visible on npm within ${verifyTimeoutMinutes} minutes.`);
}
if (problems.length > 0) throw new Error(problems.join("\n"));

console.log(`Confirmed ${publishablePackages.length} package versions on npm.`);
