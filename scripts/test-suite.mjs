import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

const mode = process.argv[2] ?? "full";
if (mode !== "core" && mode !== "full") {
  throw new Error("Usage: bun scripts/test-suite.mjs <core|full>");
}

const corePhases = [
  ["Icon unit tests", "icons:test"],
  ["Internal Figma plugin", "test:vadivam-internal"],
  ["Public Figma plugin", "test:figma-plugin"],
  ["Package generation", "icons:build"],
  ["Package validation", "packages:check:built"],
  ["Documentation types", null, ["run", "--cwd", "apps/docs", "check"]],
  ["Documentation links", null, ["run", "--cwd", "apps/docs", "validate"]],
  ["Documentation build and SEO", "test:seo:built"],
];
const phases =
  mode === "full"
    ? [...corePhases, ["Framework integrations", "test:integration:built"]]
    : corePhases;

function formatDuration(milliseconds) {
  return `${(milliseconds / 1000).toFixed(2)}s`;
}

function runPhase(label, script, explicitArgs) {
  const args = explicitArgs ?? ["run", script];
  const startedAt = performance.now();
  console.log(`\n[tests] ${label}`);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      const duration = formatDuration(performance.now() - startedAt);
      if (code === 0) {
        console.log(`[tests] ${label} passed in ${duration}`);
        resolve();
        return;
      }
      reject(new Error(`${label} failed after ${duration} (${signal ?? code})`));
    });
  });
}

const suiteStartedAt = performance.now();
for (const [label, script, args] of phases) await runPhase(label, script, args);
console.log(
  `\n[tests] ${mode} suite passed in ${formatDuration(performance.now() - suiteStartedAt)}`,
);
