import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverDirectory = path.join(root, "apps/docs/dist/server");

export const WORKER_SOURCE = "apps/docs/worker/index.mjs";
export const WORKER_ENTRY = "vadivam-worker.mjs";
export const BLUME_ENTRY = "blume-worker.mjs";
export const MCP_ROUTE = "/mcp";

// Blume's generated config points at its own Worker and ships it unbundled.
// Point it at the wrapper instead and make sure /mcp reaches the Worker
// before the static assets layer.
export function withWorkerEntry(config) {
  const next = structuredClone(config);
  if (next.main !== BLUME_ENTRY && next.main !== WORKER_ENTRY) {
    throw new Error(`Unexpected Worker entry "${next.main}" in the generated Wrangler config`);
  }
  next.main = WORKER_ENTRY;
  if (!Array.isArray(next.assets?.run_worker_first)) {
    throw new Error("The generated Wrangler config has no assets.run_worker_first list");
  }
  const routes = next.assets.run_worker_first.filter((rule) => rule !== MCP_ROUTE);
  next.assets.run_worker_first = routes;
  // Wrangler rejects a rule that another rule already covers, so only add
  // /mcp when Blume's rules do not already send it to the Worker.
  if (!runsWorkerFirst(routes, MCP_ROUTE)) routes.unshift(MCP_ROUTE);
  if (!runsWorkerFirst(routes, MCP_ROUTE)) {
    throw new Error(`${MCP_ROUTE} is excluded from assets.run_worker_first`);
  }
  return next;
}

function routePattern(rule) {
  const source = rule.replace(/^!/, "").replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*");
  return new RegExp(`^${source}$`);
}

/** Whether `pathname` reaches the Worker before static assets under these rules. */
export function runsWorkerFirst(routes, pathname) {
  const included = routes.some((rule) => !rule.startsWith("!") && routePattern(rule).test(pathname));
  const excluded = routes.some((rule) => rule.startsWith("!") && routePattern(rule).test(pathname));
  return included && !excluded;
}

export async function buildDocsWorker() {
  const result = await Bun.build({
    entrypoints: [path.join(root, WORKER_SOURCE)],
    outdir: serverDirectory,
    naming: WORKER_ENTRY,
    target: "browser",
    format: "esm",
    conditions: ["workerd", "worker", "browser"],
    minify: { syntax: true, whitespace: false, identifiers: false },
    plugins: [
      {
        name: "blume-worker-external",
        setup(build) {
          build.onResolve({ filter: /^\.\/blume-worker\.mjs$/ }, () => ({
            path: `./${BLUME_ENTRY}`,
            external: true,
          }));
        },
      },
    ],
  });
  if (!result.success) {
    throw new AggregateError(result.logs, "Could not bundle the docs Worker");
  }
  const configPath = path.join(serverDirectory, "wrangler.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  await writeFile(configPath, `${JSON.stringify(withWorkerEntry(config), null, 2)}\n`);
  const output = result.outputs[0];
  console.log(
    `Bundled ${path.relative(root, output.path)} (${(output.size / 1024).toFixed(0)} KiB) with the MCP endpoint at ${MCP_ROUTE}.`,
  );
}

if (import.meta.main) await buildDocsWorker();
