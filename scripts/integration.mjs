// Installs and builds the framework integration apps under tests/integration.
// Each app consumes a locally built package via a `file:` dependency, so
// `bun run icons:build` must run before this script. A successful build for
// every app is the integration test.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const integrationDir = path.join(root, "tests", "integration");
const apps = [
  { name: "nextjs", packages: ["vadivam-react"] },
  { name: "tanstack-start", packages: ["vadivam-react"] },
  { name: "vite-react", packages: ["vadivam-react"] },
  { name: "expo", packages: ["vadivam-react-native"] },
];

function run(cmd, args, cwd) {
  console.log(`\n$ ${cmd} ${args.join(" ")}  (cwd: ${path.relative(root, cwd)})`);
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`\`${cmd} ${args.join(" ")}\` failed in ${cwd} (exit ${result.status})`);
  }
}

// Replace the `file:` symlink tree bun creates with real files. Turbopack (and
// some other bundlers) cannot follow bun's per-file symlinks for a local
// dependency, so we copy the freshly built package in as plain files.
function materializePackage(cwd, packageName) {
  const src = path.join(root, "packages", packageName);
  const dest = path.join(cwd, "node_modules", packageName);
  rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, {
    recursive: true,
    dereference: true,
    filter: (src) => !src.includes(`${path.sep}node_modules${path.sep}`),
  });
}

for (const app of apps) {
  const cwd = path.join(integrationDir, app.name);
  if (!existsSync(cwd)) {
    throw new Error(`integration app missing: ${cwd}`);
  }
  // Use the committed per-app lockfile for reproducible installs.
  run("bun", ["install", "--frozen-lockfile"], cwd);
  for (const packageName of app.packages) materializePackage(cwd, packageName);
  run("bun", ["run", "build"], cwd);
}

console.log(`\nIntegration builds passed for: ${apps.map((app) => app.name).join(", ")}`);
