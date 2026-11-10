import { mcpRoute } from "../apps/docs/worker/routes.mjs";
import { existsSync, readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import path from "node:path";
import { sharedModules } from "./generators/mcp.mjs";
import { packagePath, styles } from "./icon-styles.mjs";
import { root } from "./lib/paths.mjs";
import { forEachConcurrently, run } from "./lib/process.mjs";
import { mcpServerManifest, npmPackages, packageMetadata, repositoryUrl } from "./packages.mjs";

const rootVersion = JSON.parse(
  readFileSync(path.join(root, "package.json"), "utf8"),
).version;

function getPackResult(packed, packageName) {
  const result = Array.isArray(packed)
    ? packed[0]
    : packed?.[packageName] ?? Object.values(packed ?? {})[0];
  if (!result || result.name !== packageName || !Array.isArray(result.files)) {
    throw new Error(`${packageName}: unexpected npm pack --json output`);
  }
  return result;
}

async function validatePackage({
  id,
  packageName: name,
  directory,
  description,
  documentation,
  keywords,
  readmeSearchPhrase,
}) {
  const startedAt = performance.now();
  const cwd = path.join(root, directory);
  const manifest = JSON.parse(readFileSync(path.join(cwd, "package.json"), "utf8"));
  if (manifest.name !== name) throw new Error(`${directory}: expected name ${name}`);
  if (manifest.version !== rootVersion) {
    throw new Error(`${name}: version ${manifest.version} does not match ${rootVersion}`);
  }
  const expectedMetadata = {
    author: packageMetadata.author,
    bugs: packageMetadata.bugs,
    description,
    homepage: packageMetadata.homepage,
    keywords: [...packageMetadata.sharedKeywords, ...keywords],
    license: packageMetadata.license,
    repository: {
      type: "git",
      url: packageMetadata.repositoryUrl,
      directory,
    },
  };
  for (const [field, expected] of Object.entries(expectedMetadata)) {
    if (JSON.stringify(manifest[field]) !== JSON.stringify(expected)) {
      throw new Error(`${name}: ${field} metadata is out of sync`);
    }
  }
  if (!existsSync(path.join(cwd, "dist"))) throw new Error(`${name}: missing dist`);
  const readme = readFileSync(path.join(cwd, "README.md"), "utf8");
  const requiredReadmeContent = [
    `# ${name}`,
    readmeSearchPhrase,
    packageMetadata.homepage,
    `${packageMetadata.homepage}${documentation}`,
    `${repositoryUrl}/tree/main/${directory}`,
  ];
  for (const expected of requiredReadmeContent) {
    if (!readme.includes(expected)) {
      throw new Error(`${name}: README is missing ${expected}`);
    }
  }
  // publint opens every file its export globs match at once. Under Node, a
  // package with more matches than the open-file limit reports the files it
  // could not open as missing; Bun's runtime does not, so run it there.
  await run("bun", ["--bun", "x", "publint", "."], { cwd });
  const packed = JSON.parse(
    await run("npm", ["pack", "--dry-run", "--json"], { cwd, capture: true }),
  );
  const packResult = getPackResult(packed, name);
  if (packResult.version !== rootVersion) {
    throw new Error(`${name}: tarball version ${packResult.version} does not match ${rootVersion}`);
  }
  const files = packResult.files.map(({ path: file }) => file);
  if (!files.some((file) => file.startsWith("dist/"))) {
    throw new Error(`${name}: npm tarball contains no dist files`);
  }
  if (!files.includes("README.md") || !files.includes("LICENSE")) {
    throw new Error(`${name}: npm tarball is missing README.md or LICENSE`);
  }
  packageChecks[id]?.(manifest, files);
  console.log(
    `Validated ${name}@${rootVersion} (${files.length} files) in ${((performance.now() - startedAt) / 1000).toFixed(2)}s.`,
  );
}

// Every style's font is in the core package's one font/ folder, as a
// stylesheet and the WOFF2 file it loads.
const fontFiles = Object.values(styles).flatMap(({ font }) => ["css", "woff2"].map((extension) => `dist/font/${font.fontName}.${extension}`));
const fontStylesheets = fontFiles.filter((file) => file.endsWith(".css"));

function validateCorePackage(manifest, files) {
  const { name } = manifest;
  if (JSON.stringify(manifest.sideEffects) !== JSON.stringify(["dist/elements.js", ...fontStylesheets].map((file) => `./${file}`))) {
    throw new Error(`${name}: elements and font CSS must be preserved as side effects`);
  }
  const requiredStaticAssets = [
    "dist/elements.d.ts",
    "dist/elements.js",
    ...fontFiles,
    ...Object.values(styles).flatMap((style) =>
      ["sprite.svg", "icons/activity.svg", "strings/activity.d.ts", "strings/activity.js"].map((file) => packagePath(style, file)),
    ),
    "skills/vadivam-icons/SKILL.md",
  ];
  for (const asset of requiredStaticAssets) {
    if (!files.includes(asset)) {
      throw new Error(`${name}: npm tarball is missing ${asset}`);
    }
  }
  const forbiddenStaticAsset = files.find((file) =>
    /(?:^|\/)(?:\.cache|cache|preview|tmp|temp)(?:\/|\.|$)|\.(?:ttf|eot|woff|svgfont)$/i.test(file) ||
    (file.startsWith("dist/font/") && !fontFiles.includes(file)),
  );
  if (forbiddenStaticAsset) {
    throw new Error(`${name}: npm tarball contains unexpected font asset ${forbiddenStaticAsset}`);
  }
}

function validateMcpPackage(manifest, files) {
  const { name } = manifest;
  // npm publish rewrites "./dist/cli.js" to this form and warns that the bin
  // "was invalid and removed", so keep the published spelling in package.json.
  if (manifest.bin?.[name] !== "dist/cli.js") {
    throw new Error(`${name}: bin must map ${name} to dist/cli.js`);
  }
  for (const file of ["cli.js", "data.js", "index.js", "index.d.ts", ...sharedModules].map((file) => `dist/${file}`)) {
    if (!files.includes(file)) throw new Error(`${name}: npm tarball is missing ${file}`);
  }
  for (const [dependency, version] of Object.entries(manifest.dependencies ?? {})) {
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
      throw new Error(`${name}: pin ${dependency} to an exact version, not ${version}`);
    }
  }
  const server = JSON.parse(readFileSync(path.join(root, mcpServerManifest), "utf8"));
  if (server.name !== manifest.mcpName) {
    throw new Error(`${mcpServerManifest}: name ${server.name} does not match mcpName ${manifest.mcpName}`);
  }
  if (!server.description || server.description.length > 100) {
    throw new Error(`${mcpServerManifest}: description must be 1-100 characters`);
  }
  const versions = [server.version, ...server.packages.map((entry) => entry.version)];
  if (versions.some((version) => version !== rootVersion)) {
    throw new Error(`${mcpServerManifest}: versions ${versions.join(", ")} do not match ${rootVersion}`);
  }
  const npmEntry = server.packages.find((entry) => entry.registryType === "npm");
  if (npmEntry?.identifier !== name || npmEntry.transport?.type !== "stdio") {
    throw new Error(`${mcpServerManifest}: missing the stdio npm package entry for ${name}`);
  }
  const remote = `${packageMetadata.homepage}${mcpRoute}`;
  if (!server.remotes?.some((entry) => entry.type === "streamable-http" && entry.url === remote)) {
    throw new Error(`${mcpServerManifest}: missing the streamable-http remote ${remote}`);
  }
}

// What a package must ship besides what every package does, by target id.
const packageChecks = { core: validateCorePackage, mcp: validateMcpPackage };

await forEachConcurrently(npmPackages, 3, validatePackage);
