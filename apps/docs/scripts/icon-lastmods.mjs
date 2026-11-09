import { execFileSync } from "node:child_process";

let lastmods;

/**
 * Map each icon name to the date (YYYY-MM-DD) of the last commit that touched
 * its source SVG, so the sitemap's `lastmod` and the docs pages' JSON-LD
 * `dateModified` stay accurate. Read once per process: the homepage and every
 * icon page share it. `:(top)` keeps the pathspec and output root-relative
 * from any directory in the repository.
 */
export function iconLastmods() {
  lastmods ??= readIconLastmods();
  return lastmods;
}

function readIconLastmods() {
  let output;
  try {
    output = execFileSync("git", ["log", "--format=%cI", "--name-only", "--", ":(top)icons/"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    // A source export without git history (git missing, or not a repository)
    // still builds; its pages and sitemap just carry no modified dates. Any
    // other git failure is a real error.
    if (error.code === "ENOENT" || /not a git repository/i.test(String(error.stderr))) {
      console.warn("No git history, so icon pages and the sitemap omit modified dates.");
      return new Map();
    }
    throw error;
  }
  // Newest commits come first, so the first date seen for a file wins.
  const modified = new Map();
  let committedAt = null;
  for (const line of output.split("\n")) {
    if (!line.trim()) continue;
    if (/^\d{4}-\d{2}-\d{2}/.test(line)) {
      committedAt = line.slice(0, 10);
      continue;
    }
    const match = line.match(/^icons\/(.+)\.svg$/);
    if (match && committedAt && !modified.has(match[1])) {
      modified.set(match[1], committedAt);
    }
  }
  return modified;
}
