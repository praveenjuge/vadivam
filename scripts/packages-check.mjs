import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { packageMetadata, publishablePackages } from "./packages.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootVersion = JSON.parse(
  readFileSync(path.join(root, "package.json"), "utf8"),
).version;

function run(command, args, cwd, capture = false) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: capture ? "utf8" : undefined,
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.status !== 0) {
    if (capture) process.stderr.write(result.stderr ?? result.stdout ?? "");
    throw new Error(`${command} ${args.join(" ")} failed in ${cwd}`);
  }
  return result.stdout;
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

for (const { name, directory, description, documentation, keywords, readmeSearchPhrase } of publishablePackages) {
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
  run("bun", ["x", "publint", "."], cwd);
  const packed = JSON.parse(run("npm", ["pack", "--dry-run", "--json"], cwd, true));
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
    const requiredStaticAssets = [
      "dist/font/vadivam.css",
      "dist/font/vadivam.woff2",
      "dist/sprite.svg",
      "dist/strings/activity.d.ts",
      "dist/strings/activity.js",
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
  console.log(`Validated ${name}@${rootVersion} (${files.length} files).`);
}
