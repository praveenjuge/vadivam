import { execFileSync } from "node:child_process";
import { styleIds, styles } from "../../../scripts/icon-styles.mjs";

const sourceDirectories = new Set(styleIds.map((id) => styles[id].sourceDirectory));

let lastmods;

/**
 * Map each icon name to the date (YYYY-MM-DD) of the last commit that touched
 * its source SVG in any style, so the sitemap's `lastmod` and the docs pages'
 * JSON-LD `dateModified` stay accurate. Read once per process: the homepage
 * and every icon page share it. `:(top)` keeps the pathspecs and output
 * root-relative from any directory in the repository.
 */
export function iconLastmods() {
  lastmods ??= readIconLastmods();
  return lastmods;
}

function readIconLastmods() {
  let output;
  try {
    output = execFileSync(
      "git",
      ["log", "--format=%cI", "--name-only", "--", ...[...sourceDirectories].map((directory) => `:(top)${directory}/`)],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch (error) {
    // Without readable history (no git, no repository, or a checkout git
    // refuses as dubious ownership) the site still builds, without dates.
    const reason = String(error.stderr ?? "").trim().split("\n")[0] || error.message;
    console.warn(`Icon pages and the sitemap omit modified dates: git log failed (${reason}).`);
    return new Map();
  }
  // Newest commits come first, so the first date seen for an icon wins.
  const modified = new Map();
  let committedAt = null;
  for (const line of output.split("\n")) {
    if (!line.trim()) continue;
    if (/^\d{4}-\d{2}-\d{2}/.test(line)) {
      committedAt = line.slice(0, 10);
      continue;
    }
    const match = line.match(/^([^/]+)\/([^/]+)\.svg$/);
    if (match && sourceDirectories.has(match[1]) && committedAt && !modified.has(match[2])) {
      modified.set(match[2], committedAt);
    }
  }
  return modified;
}
