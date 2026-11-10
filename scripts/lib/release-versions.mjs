// Every place the release version is written, shared by bump-version.mjs,
// which rewrites them, and validate-versions.mjs, which checks them.
import path from "node:path";
import { mcpServerManifest, nativePackages, releaseManifests, targets } from "../packages.mjs";

const lockfile = "bun.lock";
const readmes = ["README.md", ...targets.map(({ directory }) => `${directory}/README.md`)];

// bun.lock records each workspace's version under its directory.
function workspaceVersionRange(contents, workspace) {
  const entry = contents.indexOf(`"${workspace}": {`);
  const key = '"version": "';
  const start = contents.indexOf(key, entry) + key.length;
  if (entry < 0 || start < key.length || contents.lastIndexOf("}", start) > entry) {
    throw new Error(`${lockfile} has no version for workspace ${workspace}`);
  }
  return [start, contents.indexOf('"', start)];
}

const workspaces = releaseManifests.map((file) => path.dirname(file)).filter((directory) => directory !== ".");

// READMEs version the preview image's URL, which busts the GitHub Camo and
// npm image caches, and the Compose README names the Gradle coordinate.
const readmeVersions = [
  { pattern: /preview\.png(?:\?v=([^)\s"']+))?/g, text: (version) => `preview.png?v=${version}` },
  { pattern: /vadivam-compose:(\d+\.\d+\.\d+)/g, text: (version) => `vadivam-compose:${version}` },
];

const manifest = {
  read: (contents) => [JSON.parse(contents).version],
  write: (contents, version) => `${JSON.stringify({ ...JSON.parse(contents), version }, null, 2)}\n`,
};

const serverManifest = {
  read(contents) {
    const server = JSON.parse(contents);
    return [server.version, ...server.packages.map((entry) => entry.version)];
  },
  write(contents, version) {
    const server = JSON.parse(contents);
    const packages = server.packages.map((entry) => ({ ...entry, version }));
    return `${JSON.stringify({ ...server, version, packages }, null, 2)}\n`;
  },
};

const lock = {
  read: (contents) => workspaces.map((workspace) => contents.slice(...workspaceVersionRange(contents, workspace))),
  write: (contents, version) =>
    workspaces.reduce((updated, workspace) => {
      const [start, end] = workspaceVersionRange(updated, workspace);
      return `${updated.slice(0, start)}${version}${updated.slice(end)}`;
    }, contents),
};

const readme = {
  read: (contents) => readmeVersions.flatMap(({ pattern }) => [...contents.matchAll(pattern)].map((match) => match[1])),
  write: (contents, version) => readmeVersions.reduce((updated, { pattern, text }) => updated.replace(pattern, text(version)), contents),
};

const versionLineOf = ({ versionFile, versionPattern, versionLine }) => ({
  read: (contents) => [contents.match(versionPattern)?.[1].trim()],
  write(contents, version) {
    if (!versionPattern.test(contents)) throw new Error(`${versionFile} has no version line`);
    return contents.replace(versionPattern, versionLine(version));
  },
});

/**
 * Each file a version bump rewrites, relative to the repository root, with how
 * it carries the version: `read(contents)` lists every version written in it
 * (undefined where one is missing) and `write(contents, version)` returns the
 * file on the new version.
 */
export const versionedFiles = [
  ...releaseManifests.map((file) => [file, manifest]),
  ...nativePackages.map((target) => [target.versionFile, versionLineOf(target)]),
  [mcpServerManifest, serverManifest],
  [lockfile, lock],
  ...readmes.map((file) => [file, readme]),
];
