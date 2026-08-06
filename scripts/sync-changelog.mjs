#!/usr/bin/env bun
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const changelogDir = path.join(root, "apps/docs/changelog");

const OWNER = "praveenjuge";
const REPO = "vadivam";
const DESCRIPTION_MAX = 160;
const DESCRIPTION_MIN = 110;

const LEADING_V = /^v/iu;
const NON_SLUG = /[^a-z0-9]+/gu;
const EDGE_DASHES = /^-+|-+$/gu;
const CODE_FENCE = /```[\s\S]*?```/gu;
const HEADING_LINE = /^#{1,6}\s.*$/gmu;
const LIST_MARK = /^\s*(?:[-*+]|\d+[.)])\s+/u;
const CHANGESET_HASH = /^[0-9a-f]{7,40}:\s+/u;
const IMAGE = /!\[[^\]]*\]\([^)]*\)/gu;
const LINK = /\[([^\]]*)\]\([^)]*\)/gu;
const INLINE_CODE = /`([^`]+)`/gu;
const HTML_OR_JSX = /<\/?[a-zA-Z][^\n<>]*>|<\/?>/gu;
const MARKDOWN_PUNCT = /[*_~>]+/gu;
const WHITESPACE = /\s+/gu;
const TRAILING_FRAGMENT = /[\s,;:.—–-]+$/u;

const slugifyTag = (tag) =>
  tag.toLowerCase().replaceAll(NON_SLUG, "-").replaceAll(EDGE_DASHES, "");

const releaseDescription = (body) => {
  const text = body
    .replaceAll(CODE_FENCE, " ")
    .replaceAll(HEADING_LINE, "")
    .split("\n")
    .map((line) => line.replace(LIST_MARK, "").replace(CHANGESET_HASH, ""))
    .join("\n")
    .replaceAll(IMAGE, " ")
    .replaceAll(LINK, "$1")
    .replaceAll(INLINE_CODE, "$1")
    .replaceAll(HTML_OR_JSX, " ")
    .replaceAll(MARKDOWN_PUNCT, " ")
    .replaceAll(WHITESPACE, " ")
    .trim();
  if (!text) return undefined;
  if (text.length <= DESCRIPTION_MAX) return text;
  const slice = text.slice(0, DESCRIPTION_MAX - 1);
  const boundary = slice.lastIndexOf(" ");
  const head = (
    boundary >= DESCRIPTION_MIN ? slice.slice(0, boundary) : slice
  ).replace(TRAILING_FRAGMENT, "");
  return `${head}…`;
};

const yamlQuote = (value) =>
  `'${String(value).replaceAll("'", "''")}'`;

const yamlFolded = (value) => {
  const words = value.trim().split(/\s+/u);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > 68 && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return `>-\n${lines.map((part) => `    ${part}`).join("\n")}`;
};

export function renderChangelogEntry({
  tag,
  title,
  date,
  body,
  prerelease = false,
}) {
  const version = tag.replace(LEADING_V, "");
  const category = prerelease ? "Prerelease" : "Release";
  const normalizedBody = body.replaceAll("\r\n", "\n").trim();
  const description = releaseDescription(normalizedBody);
  const lines = [
    "---",
    "changelog:",
    `  category: ${category}`,
    `  version: ${version}`,
    `date: ${yamlQuote(date)}`,
  ];
  if (description) {
    lines.push("seo:", `  description: ${yamlFolded(description)}`);
  }
  lines.push(
    `title: ${yamlQuote(title || tag)}`,
    "type: changelog",
    "---",
    normalizedBody,
    ""
  );
  return lines.join("\n");
}

export function changelogPathForTag(tag) {
  return path.join(changelogDir, `${slugifyTag(tag)}.md`);
}

export function writeChangelogEntry(release) {
  mkdirSync(changelogDir, { recursive: true });
  const filePath = changelogPathForTag(release.tag);
  writeFileSync(filePath, renderChangelogEntry(release));
  return filePath;
}

async function githubHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "vadivam-sync-changelog",
  };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function fetchAllReleases() {
  const headers = await githubHeaders();
  const releases = [];
  let page = 1;
  while (true) {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/releases?per_page=100&page=${page}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`GitHub releases fetch failed: ${url} -> ${res.status}`);
    }
    const batch = await res.json();
    releases.push(...batch.filter((release) => !release.draft));
    if (batch.length < 100) break;
    page += 1;
  }
  return releases;
}

async function syncFromGitHub() {
  const releases = await fetchAllReleases();
  mkdirSync(changelogDir, { recursive: true });
  const written = [];
  for (const release of releases) {
    const filePath = writeChangelogEntry({
      tag: release.tag_name,
      title: release.name?.trim() || release.tag_name,
      date: release.published_at ?? release.created_at,
      body: release.body ?? "",
      prerelease: Boolean(release.prerelease),
    });
    written.push(path.relative(root, filePath));
  }
  return written;
}

function parseArgs(argv) {
  const args = { write: false, tag: "", title: "", date: "", body: "", bodyFile: "" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--write") args.write = true;
    else if (arg === "--tag") args.tag = argv[++i] ?? "";
    else if (arg === "--title") args.title = argv[++i] ?? "";
    else if (arg === "--date") args.date = argv[++i] ?? "";
    else if (arg === "--body-file") args.bodyFile = argv[++i] ?? "";
    else if (arg === "--body") args.body = argv[++i] ?? "";
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

if (import.meta.main) {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(
      "Usage:\n" +
        "  bun scripts/sync-changelog.mjs\n" +
        "  bun scripts/sync-changelog.mjs --write --tag v0.0.42 --body-file notes.md [--date ISO] [--title title]\n"
    );
    process.exit(0);
  }

  if (args.write) {
    if (!args.tag) throw new Error("--tag is required with --write");
    const body = args.bodyFile
      ? await Bun.file(path.resolve(args.bodyFile)).text()
      : args.body;
    if (!body?.trim()) throw new Error("Release notes body is required");
    const filePath = writeChangelogEntry({
      tag: args.tag,
      title: args.title || args.tag,
      date: args.date || new Date().toISOString(),
      body,
    });
    process.stdout.write(`${path.relative(root, filePath)}\n`);
  } else {
    const written = await syncFromGitHub();
    if (!written.length) {
      throw new Error("No GitHub releases found to sync into apps/docs/changelog");
    }
    process.stdout.write(`Synced ${written.length} changelog entries.\n`);
  }

  const count = readdirSync(changelogDir).filter((file) => file.endsWith(".md")).length;
  if (count < 1) {
    throw new Error("apps/docs/changelog has no markdown entries after sync");
  }
}
