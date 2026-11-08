// Runs the repository's test phases in order and reports how long each took.
// Usage: bun scripts/test-suite.mjs <core|full>
import { performance } from "node:perf_hooks";
import { run } from "./lib/process.mjs";

const mode = process.argv[2] ?? "full";
if (mode !== "core" && mode !== "full") {
  throw new Error("Usage: bun scripts/test-suite.mjs <core|full>");
}

// Each phase is a label and the arguments to `bun run`.
const corePhases = [
  ["Icon unit tests", "icons:test"],
  ["Internal Figma plugin", "test:vadivam-internal"],
  ["Public Figma plugin", "test:figma-plugin"],
  ["Package generation", "icons:build"],
  ["Package validation", "packages:check:built"],
  ["shadcn registry", "test:shadcn:built"],
  ["Documentation types", "--cwd", "apps/docs", "check"],
  ["Documentation links", "--cwd", "apps/docs", "validate"],
  ["Documentation build and SEO", "test:seo:built"],
];
const phases = mode === "full" ? [...corePhases, ["Framework integrations", "test:integration:built"]] : corePhases;

const seconds = (since) => `${((performance.now() - since) / 1000).toFixed(2)}s`;

const suiteStartedAt = performance.now();
for (const [label, ...args] of phases) {
  const startedAt = performance.now();
  console.log(`\n[tests] ${label}`);
  try {
    await run(process.execPath, ["run", ...args]);
  } catch (error) {
    throw new Error(`${label} failed after ${seconds(startedAt)}: ${error.message}`);
  }
  console.log(`[tests] ${label} passed in ${seconds(startedAt)}`);
}
console.log(`\n[tests] ${mode} suite passed in ${seconds(suiteStartedAt)}`);
