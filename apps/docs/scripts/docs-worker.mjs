import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { blumeWorkerEntry, mcpRoute } from "../worker/routes.mjs";
import { docsPaths, fromRoot } from "./paths.mjs";

export const WORKER_ENTRY = "vadivam-worker.mjs";

// Blume's generated config points at its own Worker and ships it unbundled.
// Point it at the wrapper instead and make sure the MCP route reaches the
// Worker before the static assets layer.
export function withWorkerEntry(config) {
  const next = structuredClone(config);
  if (next.main !== blumeWorkerEntry && next.main !== WORKER_ENTRY) {
    throw new Error(`Unexpected Worker entry "${next.main}" in the generated Wrangler config`);
  }
  next.main = WORKER_ENTRY;
  if (!Array.isArray(next.assets?.run_worker_first)) {
    throw new Error("The generated Wrangler config has no assets.run_worker_first list");
  }
  const routes = next.assets.run_worker_first.filter((rule) => rule !== mcpRoute);
  next.assets.run_worker_first = routes;
  // Wrangler rejects a rule that another rule already covers, so only add
  // the route when Blume's rules do not already send it to the Worker.
  if (!runsWorkerFirst(routes, mcpRoute)) routes.unshift(mcpRoute);
  if (!runsWorkerFirst(routes, mcpRoute)) {
    throw new Error(`${mcpRoute} is excluded from assets.run_worker_first`);
  }
  return next;
}

/** Whether `pathname` matches a Wrangler route glob, where `*` matches any run of characters. */
function matchesRoute(rule, pathname) {
  const [first = "", ...rest] = rule.replace(/^!/, "").split("*");
  if (!pathname.startsWith(first)) return false;
  if (rest.length === 0) return pathname === first;
  let index = first.length;
  for (const [position, part] of rest.entries()) {
    if (position === rest.length - 1) return pathname.length - part.length >= index && pathname.endsWith(part);
    const found = pathname.indexOf(part, index);
    if (found < 0) return false;
    index = found + part.length;
  }
  return false;
}

/** Whether `pathname` reaches the Worker before static assets under these rules. */
export function runsWorkerFirst(routes, pathname) {
  const included = routes.some((rule) => !rule.startsWith("!") && matchesRoute(rule, pathname));
  const excluded = routes.some((rule) => rule.startsWith("!") && matchesRoute(rule, pathname));
  return included && !excluded;
}

/** Bundle the docs Worker next to Blume's and point the generated config at it. */
export async function buildDocsWorker() {
  const blumeImport = `./${blumeWorkerEntry}`;
  const result = await Bun.build({
    entrypoints: [fromRoot(docsPaths.workerSource)],
    outdir: fromRoot(docsPaths.server),
    naming: WORKER_ENTRY,
    target: "browser",
    format: "esm",
    conditions: ["workerd", "worker", "browser"],
    minify: { syntax: true, whitespace: false, identifiers: false },
    plugins: [
      {
        name: "blume-worker-external",
        setup(build) {
          build.onResolve({ filter: /^\.\// }, ({ path: specifier }) =>
            specifier === blumeImport ? { path: blumeImport, external: true } : undefined,
          );
        },
      },
    ],
  });
  if (!result.success) {
    throw new AggregateError(result.logs, "Could not bundle the docs Worker");
  }
  const configPath = fromRoot(docsPaths.generatedConfig);
  const config = JSON.parse(await readFile(configPath, "utf8"));
  await writeFile(configPath, `${JSON.stringify(withWorkerEntry(config), null, 2)}\n`);
  const output = result.outputs[0];
  console.log(
    `Bundled ${path.relative(fromRoot("."), output.path)} (${(output.size / 1024).toFixed(0)} KiB) with the MCP endpoint at ${mcpRoute}.`,
  );
}
