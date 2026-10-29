import { existsSync, readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { mcpServerManifest, packageMetadata, publishablePackages } from "./packages.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootVersion = JSON.parse(
  readFileSync(path.join(root, "package.json"), "utf8"),
).version;

function run(command, args, cwd, capture = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let stdout = "";
    let stderr = "";
    if (capture) {
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
    }
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      if (capture) process.stderr.write(stderr || stdout);
      reject(new Error(`${command} ${args.join(" ")} failed in ${cwd}`));
    });
  });
}

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
  name,
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
    `https://github.com/praveenjuge/vadivam/tree/main/${directory}`,
    "Package family:",
  ];
  for (const expected of requiredReadmeContent) {
    if (!readme.includes(expected)) {
      throw new Error(`${name}: README is missing ${expected}`);
    }
  }
  for (const other of publishablePackages.filter((candidate) => candidate.name !== name)) {
    if (!readme.includes(`https://www.npmjs.com/package/${other.name}`)) {
      throw new Error(`${name}: README does not link package family member ${other.name}`);
    }
  }
  await run("bun", ["x", "publint", "."], cwd);
  const packed = JSON.parse(
    await run("npm", ["pack", "--dry-run", "--json"], cwd, true),
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
  if (name === "vadivam") {
    if (
      JSON.stringify(manifest.sideEffects) !==
      JSON.stringify(["./dist/elements.js", "./dist/font/vadivam.css"])
    ) {
      throw new Error(`${name}: elements and font CSS must be preserved as side effects`);
    }
    const requiredStaticAssets = [
      "dist/elements.d.ts",
      "dist/elements.js",
      "dist/font/vadivam.css",
      "dist/font/vadivam.woff2",
      "dist/sprite.svg",
      "dist/strings/activity.d.ts",
      "dist/strings/activity.js",
      "skills/vadivam-icons/SKILL.md",
    ];
    for (const asset of requiredStaticAssets) {
      if (!files.includes(asset)) {
        throw new Error(`${name}: npm tarball is missing ${asset}`);
      }
    }
    const forbiddenStaticAsset = files.find((file) =>
      /(?:^|\/)(?:\.cache|cache|preview|tmp|temp)(?:\/|\.|$)|\.(?:ttf|eot|woff|svgfont)$/i.test(
        file,
      ) ||
      (file.startsWith("dist/font/") &&
        file !== "dist/font/vadivam.css" &&
        file !== "dist/font/vadivam.woff2"),
    );
    if (forbiddenStaticAsset) {
      throw new Error(`${name}: npm tarball contains unexpected font asset ${forbiddenStaticAsset}`);
    }
  }
  if (name === "vadivam-mcp") validateMcpPackage(manifest, files);
  console.log(
    `Validated ${name}@${rootVersion} (${files.length} files) in ${((performance.now() - startedAt) / 1000).toFixed(2)}s.`,
  );
}

function validateMcpPackage(manifest, files) {
  const { name } = manifest;
  // npm publish rewrites "./dist/cli.js" to this form and warns that the bin
  // "was invalid and removed", so keep the published spelling in package.json.
  if (manifest.bin?.[name] !== "dist/cli.js") {
    throw new Error(`${name}: bin must map ${name} to dist/cli.js`);
  }
  for (const file of ["dist/cli.js", "dist/data.js", "dist/index.js", "dist/index.d.ts", "dist/snippets.js"]) {
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
  const remote = `${packageMetadata.homepage}/mcp`;
  if (!server.remotes?.some((entry) => entry.type === "streamable-http" && entry.url === remote)) {
    throw new Error(`${mcpServerManifest}: missing the streamable-http remote ${remote}`);
  }
}

async function validatePackages(concurrency) {
  let nextIndex = 0;
  let firstError;
  const workers = Array.from(
    { length: Math.min(concurrency, publishablePackages.length) },
    async () => {
      while (!firstError) {
        const index = nextIndex;
        nextIndex += 1;
        const packageDefinition = publishablePackages[index];
        if (!packageDefinition) return;
        try {
          await validatePackage(packageDefinition);
        } catch (error) {
          firstError ??= error;
        }
      }
    },
  );
  await Promise.all(workers);
  if (firstError) throw firstError;
}

await validatePackages(3);
