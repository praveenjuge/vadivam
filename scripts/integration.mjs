// Installs and builds the framework integration apps under tests/integration.
// Each app consumes the locally built `vadivam-react` package via a `file:`
// dependency, so `bun run icons:build` must run before this script. A
// successful `build` for every app IS the integration test.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const integrationDir = path.join(root, "tests", "integration");
const pkgSrc = path.join(root, "packages", "vadivam-react");

const apps = ["nextjs", "tanstack-start", "vite-react"];

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
function materializePackage(cwd) {
  const dest = path.join(cwd, "node_modules", "vadivam-react");
  rmSync(dest, { recursive: true, force: true });
  cpSync(pkgSrc, dest, {
    recursive: true,
    dereference: true,
    filter: (src) => !src.includes(`${path.sep}node_modules${path.sep}`),
  });
}

for (const app of apps) {
  const cwd = path.join(integrationDir, app);
  if (!existsSync(cwd)) {
    throw new Error(`integration app missing: ${cwd}`);
  }
  // Use the committed per-app lockfile for reproducible installs.
  run("bun", ["install", "--frozen-lockfile"], cwd);
  materializePackage(cwd);
  run("bun", ["run", "build"], cwd);
}

console.log(`\nIntegration builds passed for: ${apps.join(", ")}`);
