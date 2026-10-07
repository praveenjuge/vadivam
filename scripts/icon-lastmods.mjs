import { execFileSync } from "node:child_process";

/**
 * Map each icon name to the date (YYYY-MM-DD) of the last commit that touched
 * its source SVG, so the sitemap's `lastmod` and the docs pages' JSON-LD
 * `dateModified` stay accurate. Newest-first history means the first hit per
 * file wins. `:(top)` keeps the pathspec and output root-relative from any
 * directory in the repo. Outside a git repo, returns an empty map and callers
 * simply omit the date.
 */
export function iconLastmods(cwd = process.cwd()) {
  try {
    const output = execFileSync(
      "git",
      ["log", "--format=%cI", "--name-only", "--", ":(top)icons/"],
      { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
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
  } catch {
    return new Map();
  }
}
