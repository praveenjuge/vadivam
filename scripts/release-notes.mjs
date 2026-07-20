import { readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { publishablePackages } from "./packages.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const packageLinks = new Map(
  publishablePackages.map(({ name, directory }) => [
    directory,
    `[${name}](https://www.npmjs.com/package/${name})`,
  ]),
);

const iconName = (file) => path.basename(file, ".svg");
const uniqueSorted = (values) => [...new Set(values)].sort();

export function summarizeReleaseDiff(diff) {
  const icons = { added: [], changed: [], removed: [] };
  const changedFiles = [];
  for (const line of diff.split("\n").filter(Boolean)) {
    const [status, ...files] = line.split("\t");
    changedFiles.push(...files);
    const iconFiles = files.filter((file) => file.startsWith("icons/") && file.endsWith(".svg"));
    if (status.startsWith("R") && iconFiles.length === 2) {
      icons.removed.push(iconName(iconFiles[0]));
      icons.added.push(iconName(iconFiles[1]));
    } else if (status === "A") {
      icons.added.push(...iconFiles.map(iconName));
    } else if (status === "D") {
      icons.removed.push(...iconFiles.map(iconName));
    } else if (iconFiles.length) {
      icons.changed.push(...iconFiles.map(iconName));
    }
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

export function renderReleaseNotes(summary, totalIcons) {
  const iconLines = [
    formatNames("Added", summary.icons.added),
    formatNames("Updated", summary.icons.changed),
    formatNames("Removed", summary.icons.removed),
  ].filter(Boolean);
  const iconSection = iconLines.length ? iconLines.join("\n") : "No icon source changes in this release.";
  const surfaces = summary.surfaces.length
    ? summary.surfaces.map((surface) => `- ${surface}`).join("\n")
    : "- Package metadata and release state only";

  return `Ships ${totalIcons} Vadivam icons across SVG, React, React Native, Vue, Svelte, Solid, Angular, Astro, and Preact.\n\n## Icons\n\n${iconSection}\n\n## Updated surfaces\n\n${surfaces}\n`;
}

function gitDiff(from, to) {
  const args = from
    ? ["diff", "--name-status", "--find-renames", `${from}..${to}`, "--", "icons", "packages", "apps/docs", "README.md", "CONTRIBUTING.md", "scripts", ".github/workflows"]
    : ["show", "--pretty=", "--name-status", to, "--", "icons", "packages", "apps/docs", "README.md", "CONTRIBUTING.md", "scripts", ".github/workflows"];
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || "Unable to read release diff");
  return result.stdout;
}

if (import.meta.main) {
  const [from = "", to = "HEAD"] = process.argv.slice(2);
  const totalIcons = readdirSync(path.join(root, "icons")).filter((file) => file.endsWith(".svg")).length;
  process.stdout.write(renderReleaseNotes(summarizeReleaseDiff(gitDiff(from, to)), totalIcons));
}
