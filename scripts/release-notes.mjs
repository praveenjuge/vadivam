import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { styles } from "./icon-styles.mjs";
import { root } from "./lib/paths.mjs";
import { releaseLink, targets } from "./packages.mjs";

const packageLinks = new Map(targets.map((target) => [target.directory, releaseLink(target)]));

// Each style's source folder; an icon is its outline, and the other styles hold its twins.
const sourceDirectories = Object.values(styles).map((style) => style.sourceDirectory);
const styleDirectory = (file) => sourceDirectories.find((directory) => file.startsWith(`${directory}/`));
const releasePaths = [...sourceDirectories, "packages", "apps/docs", "apps/figma-plugin", "apps/figma-shared", "README.md", "CONTRIBUTING.md", "scripts", ".github/workflows"];

const iconName = (file) => path.basename(file, ".svg");
const uniqueSorted = (values) => [...new Set(values)].sort();

export function summarizeReleaseDiff(diff) {
  const icons = { added: [], changed: [], removed: [] };
  // Each icon is listed once, whichever of its styles changed. A twin added
  // or removed while its outline stays is an update to that icon.
  const twinOnly = { added: [], removed: [] };
  const record = (kind, file) =>
    (styleDirectory(file) !== styles.outline.sourceDirectory && kind !== "changed" ? twinOnly : icons)[kind].push(iconName(file));
  const changedFiles = [];
  for (const line of diff.split("\n").filter(Boolean)) {
    const [status, ...files] = line.split("\t");
    changedFiles.push(...files);
    const iconFiles = files.filter((file) => styleDirectory(file) && file.endsWith(".svg"));
    if (status.startsWith("R") && iconFiles.length === 2) {
      record("removed", iconFiles[0]);
      record("added", iconFiles[1]);
    } else if (status === "A") {
      for (const file of iconFiles) record("added", file);
    } else if (status === "D") {
      for (const file of iconFiles) record("removed", file);
    } else {
      for (const file of iconFiles) record("changed", file);
    }
  }
  for (const kind of ["added", "removed"]) {
    for (const name of twinOnly[kind]) (icons[kind].includes(name) ? icons[kind] : icons.changed).push(name);
  }

  const surfaces = [];
  for (const [directory, link] of packageLinks) {
    if (changedFiles.some((file) => file === directory || file.startsWith(`${directory}/`))) {
      surfaces.push(link);
    }
  }
  if (changedFiles.some((file) => file === "README.md" || file === "CONTRIBUTING.md" || file.startsWith("apps/docs/"))) {
    surfaces.push("Documentation");
  }
  if (changedFiles.some((file) => file.startsWith("apps/figma-plugin/") || file.startsWith("apps/figma-shared/"))) {
    surfaces.push("Figma plugin");
  }
  if (changedFiles.some((file) => file.startsWith("scripts/") || file.startsWith(".github/workflows/"))) {
    surfaces.push("Release and generation tooling");
  }

  return {
    icons: {
      added: uniqueSorted(icons.added),
      changed: uniqueSorted(icons.changed),
      removed: uniqueSorted(icons.removed),
    },
    surfaces: uniqueSorted(surfaces),
  };
}

const formatNames = (label, names) => (names.length ? `- **${label}:** ${names.map((name) => `\`${name}\``).join(", ")}` : null);

export function renderReleaseNotes(summary, totalIcons, version) {
  const iconLines = [
    formatNames("Added", summary.icons.added),
    formatNames("Updated", summary.icons.changed),
    formatNames("Removed", summary.icons.removed),
  ].filter(Boolean);
  const iconSection = iconLines.length ? iconLines.join("\n") : "No icon source changes in this release.";
  const surfaces = summary.surfaces.length
    ? summary.surfaces.map((surface) => `- ${surface}`).join("\n")
    : "- Package metadata and release state only";

  const subject = version ? `Vadivam ${version} ships` : "Ships";
  return `${subject} ${totalIcons} Vadivam icons for the web, React Native, Flutter, and Jetpack Compose.\n\n## Icons\n\n${iconSection}\n\n## Updated surfaces\n\n${surfaces}\n`;
}

// GitHub's generated notes repeat pull request titles verbatim. A title such as
// "Add <vadivam-icon>" is raw HTML to the docs changelog, where an unclosed
// element swallows the rest of the page, so tag-like text is escaped. Code
// spans already show tags literally, and an entity there would show as "&lt;".
export function escapeHtmlTags(markdown) {
  // A code span closes with as many backticks as it opened with.
  return markdown.replace(/(`+)[^\n]*?\1(?!`)|<(?=\/?[A-Za-z])/g, (match) =>
    match.startsWith("`") ? match : "&lt;",
  );
}

function gitDiff(from, to) {
  const args = from
    ? ["diff", "--name-status", "--find-renames", `${from}..${to}`, "--", ...releasePaths]
    : ["show", "--pretty=", "--name-status", to, "--", ...releasePaths];
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || "Unable to read release diff");
  return result.stdout;
}

if (import.meta.main) {
  const [from = "", to = "HEAD", generatedNotesFile] = process.argv.slice(2);
  const totalIcons = readdirSync(path.join(root, styles.outline.sourceDirectory)).filter((file) => file.endsWith(".svg")).length;
  const generated = generatedNotesFile ? escapeHtmlTags(readFileSync(generatedNotesFile, "utf8")) : "";
  process.stdout.write(
    renderReleaseNotes(summarizeReleaseDiff(gitDiff(from, to)), totalIcons, to) +
      (generated ? `\n${generated.trim()}\n` : "")
  );
}
