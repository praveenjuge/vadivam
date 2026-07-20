import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export const privateUseStart = 0xe000;
export const privateUseEnd = 0xf8ff;

const fontName = "vadivam";
const fontFamily = "Vadivam Icons";
const fontCacheVersion = "2";

function codepointHex(codepoint) {
  return codepoint.toString(16).padStart(4, "0");
}

function assertValidRegistry(registry) {
  const allocated = new Map();
  for (const [name, codepoint] of Object.entries(registry)) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
      throw new Error(`Invalid font codepoint name: ${name}`);
    }
    if (
      !Number.isInteger(codepoint) ||
      codepoint < privateUseStart ||
      codepoint > privateUseEnd
    ) {
      throw new Error(
        `${name}: font codepoint must be inside the BMP Private Use Area from U+${codepointHex(privateUseStart)} to U+${codepointHex(privateUseEnd)}.`,
      );
    }
    if (allocated.has(codepoint)) {
      throw new Error(
        `${name}: font codepoint U+${codepointHex(codepoint)} is already allocated to ${allocated.get(codepoint)}.`,
      );
    }
    allocated.set(codepoint, name);
  }
}

export async function readFontCodepoints(registryPath) {
  const registry = JSON.parse(await readFile(registryPath, "utf8"));
  if (!registry || Array.isArray(registry) || typeof registry !== "object") {
    throw new Error("Font codepoint registry must be a JSON object.");
  }
  assertValidRegistry(registry);
  return registry;
}

export function validateFontCodepoints(icons, registry) {
  assertValidRegistry(registry);
  const missing = icons
    .map(({ name }) => name)
    .filter((name) => registry[name] === undefined);
  if (missing.length) {
    throw new Error(
      `Missing font codepoints for ${missing.join(", ")}. Run \`bun run icons:font-codepoints\` and commit the registry.`,
    );
  }
}

export async function allocateFontCodepoints(icons, registryPath) {
  let registry = {};
  try {
    registry = await readFontCodepoints(registryPath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  let nextCodepoint = Math.max(privateUseStart - 1, ...Object.values(registry));
  const missing = icons
    .map(({ name }) => name)
    .filter((name) => registry[name] === undefined)
    .sort();
  for (const name of missing) {
    nextCodepoint += 1;
    if (nextCodepoint > privateUseEnd) {
      throw new Error("The BMP Private Use Area has no remaining font codepoints.");
    }
    registry[name] = nextCodepoint;
  }

  await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
  console.log(`Allocated ${missing.length} font codepoint${missing.length === 1 ? "" : "s"}.`);
}

function svgBody(svg) {
  const open = svg.match(/<svg\b[^>]*>/);
  const close = svg.lastIndexOf("</svg>");
  if (!open || close < 0) throw new Error("Validated SVG is missing its root.");
  return svg.slice(open.index + open[0].length, close).trim();
}

async function buildStrings(icons, outputDirectory) {
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all(
    icons.flatMap((icon) => [
      writeFile(
        path.join(outputDirectory, `${icon.name}.js`),
        `const svg = ${JSON.stringify(icon.svg)};\nexport default svg;\n`,
      ),
      writeFile(
        path.join(outputDirectory, `${icon.name}.d.ts`),
        `/** @name ${icon.name}\n * @description Vadivam SVG markup string.\n * @see https://vadivam.praveenjuge.com/icons/${icon.name}\n */\ndeclare const svg: string;\nexport default svg;\n`,
      ),
    ]),
  );
}

async function buildSprite(icons, outputPath) {
  const symbols = icons
    .map(
      (icon) =>
        `  <symbol id="vadivam-${icon.name}" viewBox="0 0 24 24">\n    ${svgBody(icon.svg).replaceAll("\n", "\n    ")}\n  </symbol>`,
    )
    .join("\n");
  await writeFile(
    outputPath,
    `<svg xmlns="http://www.w3.org/2000/svg">\n${symbols}\n</svg>\n`,
  );
}

function fontCss(icons, registry) {
  const classes = icons
    .map(
      ({ name }) =>
        `.vadivam-icon-${name}::before { content: "\\${codepointHex(registry[name])}"; }`,
    )
    .join("\n");
  return `@font-face {
  font-family: "${fontFamily}";
  src: url("./vadivam.woff2") format("woff2");
  font-display: block;
  font-style: normal;
  font-weight: normal;
}

.vadivam-icon {
  display: inline-block;
  font-family: "${fontFamily}" !important;
  font-style: normal;
  font-variant: normal;
  font-weight: normal;
  line-height: 1;
  speak: never;
  text-transform: none;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

${classes}
`;
}

async function packageVersion(root, packageName) {
  const manifest = JSON.parse(
    await readFile(path.join(root, "node_modules", packageName, "package.json"), "utf8"),
  );
  return manifest.version;
}

export async function fontCacheKey(icons, registry, root) {
  const hash = createHash("sha256");
  hash.update(`vadivam-font-cache:${fontCacheVersion}\n`);
  hash.update(`svgtofont:${await packageVersion(root, "svgtofont")}\n`);
  hash.update(
    `oslllo-svg-fixer:${await packageVersion(root, "oslllo-svg-fixer")}\n`,
  );
  for (const icon of icons) {
    hash.update(`${icon.name}:${registry[icon.name]}\n${icon.svg}\n`);
  }
  return hash.digest("hex");
}

async function generateFont(icons, registry, { iconsDirectory, outputPath, root }) {
  const cacheDirectory = path.join(root, "node_modules", ".cache", "vadivam-font");
  const cachePath = path.join(
    cacheDirectory,
    `${await fontCacheKey(icons, registry, root)}.woff2`,
  );
  await mkdir(cacheDirectory, { recursive: true });
  try {
    await copyFile(cachePath, outputPath);
    return;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "vadivam-font-"));
  const outlinedDirectory = path.join(temporaryRoot, "outlined");
  const fontDirectory = path.join(temporaryRoot, "font");
  await mkdir(outlinedDirectory);
  await mkdir(fontDirectory);
  try {
    const [{ default: SVGFixer }, { createSVG, createTTF, createWOFF2 }] =
      await Promise.all([
        import("oslllo-svg-fixer"),
        import("svgtofont/lib/utils"),
      ]);
    await SVGFixer(iconsDirectory, outlinedDirectory, {
      showProgressBar: false,
      traceResolution: 800,
    }).fix();
    const options = {
      src: outlinedDirectory,
      dist: fontDirectory,
      fontName,
      startUnicode: privateUseStart,
      log: false,
      svgicons2svgfont: {
        fontName: fontFamily,
        fontId: fontName,
        fontHeight: 1000,
        normalize: false,
      },
      getIconUnicode(name) {
        const codepoint = registry[name];
        if (codepoint === undefined) {
          throw new Error(`No font codepoint is allocated for ${name}.`);
        }
        return [String.fromCodePoint(codepoint), privateUseStart];
      },
    };
    await createSVG(options);
    const ttf = await createTTF(options);
    await createWOFF2(options, ttf);
    const generatedPath = path.join(fontDirectory, `${fontName}.woff2`);
    await copyFile(generatedPath, cachePath);
    await copyFile(generatedPath, outputPath);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

export async function buildStaticAssets(
  icons,
  { iconsDirectory, outputDirectory, registryPath, root },
) {
  const registry = await readFontCodepoints(registryPath);
  validateFontCodepoints(icons, registry);

  const stringsDirectory = path.join(outputDirectory, "strings");
  const fontDirectory = path.join(outputDirectory, "font");
  await mkdir(fontDirectory, { recursive: true });
  await buildStrings(icons, stringsDirectory);
  await buildSprite(icons, path.join(outputDirectory, "sprite.svg"));
  await Promise.all([
    writeFile(path.join(fontDirectory, "vadivam.css"), fontCss(icons, registry)),
    generateFont(icons, registry, {
      iconsDirectory,
      outputPath: path.join(fontDirectory, "vadivam.woff2"),
      root,
    }),
  ]);
}
