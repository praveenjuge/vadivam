#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const changelog = path.join(root, "apps/docs/dist/changelog/index.html");
const rss = path.join(root, "apps/docs/dist/changelog/rss.xml");

const html = readFileSync(changelog, "utf8");
if (html.includes("No changelog entries yet.")) {
  throw new Error(
    "Changelog is empty after build. Blume could not load GitHub releases — set GITHUB_TOKEN (or ensure api.github.com is reachable) and rebuild."
  );
}
if (!html.includes("<h1>Changelog</h1>")) {
  throw new Error("Changelog page is missing its heading after build.");
}
const feed = readFileSync(rss, "utf8");
if (!feed.includes("<item>")) {
  throw new Error("Changelog RSS feed has no release items after build.");
}

process.stdout.write("Changelog includes GitHub release entries.\n");
