#!/usr/bin/env bun
/**
 * Docs production build. Blume's github-releases source reads GITHUB_TOKEN;
 * map GH_TOKEN when present (e.g. `gh` auth) so local and CI deploys match
 * Blume's own docs site, which fetches releases at build time.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const docs = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../apps/docs");

if (!process.env.GITHUB_TOKEN && process.env.GH_TOKEN) {
  process.env.GITHUB_TOKEN = process.env.GH_TOKEN;
}

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: docs,
    env: process.env,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

run("bunx", ["blume", "build"]);
run("bun", [path.resolve(docs, "../../scripts/assert-changelog.mjs")]);
run("bun", [path.resolve(docs, "../../scripts/complete-sitemap.mjs")]);
