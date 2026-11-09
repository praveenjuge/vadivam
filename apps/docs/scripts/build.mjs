// The docs build, in the order its steps depend on:
// 1. The 404 page's Markdown and JSON twins go into public/, because Blume
//    wires them into its Worker only when they are in the build output.
// 2. `blume build` writes dist/client and dist/server.
// 3. The docs Worker (MCP endpoint, then Blume) is bundled into dist/server.
// 4. The root wrangler.jsonc mirrors the generated config, Worker included.
// 5. The sitemap and llms.txt gain the icon pages.
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { siteUrl } from "../../../scripts/packages.mjs";
import { notFound } from "../pages/_lib/site.ts";
import { completeSitemapFiles } from "./complete-sitemap.mjs";
import { buildDocsWorker } from "./docs-worker.mjs";
import { docsPaths, fromRoot } from "./paths.mjs";
import { syncWranglerConfig } from "./sync-wrangler-config.mjs";

async function writeNotFoundTwins() {
  const links = notFound.links.map(({ path: route, label }) => ({ href: `${siteUrl}${route}`, label }));
  const markdown = [
    `# ${notFound.title}`,
    "",
    notFound.description,
    "",
    `## ${notFound.suggestions}`,
    "",
    ...links.map(({ href, label }) => `- [${label}](${href})`),
    "",
  ].join("\n");
  // An RFC 9457 problem document, like the one Blume writes for its own 404.
  const problem = {
    type: "about:blank",
    title: notFound.title,
    status: 404,
    detail: notFound.description,
    code: "PAGE_NOT_FOUND",
    resolution: `${notFound.suggestions}: ${links.map(({ href }) => href).join(", ")}`,
    links,
  };
  const publicDirectory = fromRoot(docsPaths.public);
  await Promise.all([
    writeFile(path.join(publicDirectory, "404.md"), markdown),
    writeFile(path.join(publicDirectory, "404.json"), `${JSON.stringify(problem, null, 2)}\n`),
  ]);
}

async function blumeBuild() {
  const docs = fromRoot(docsPaths.docs);
  const child = Bun.spawn([path.join(docs, "node_modules/.bin/blume"), "build"], {
    cwd: docs,
    stdio: ["inherit", "inherit", "inherit"],
  });
  const exitCode = await child.exited;
  if (exitCode !== 0) process.exit(exitCode);
}

await writeNotFoundTwins();
await blumeBuild();
await buildDocsWorker();
await syncWranglerConfig();
await completeSitemapFiles();
