import { build, context } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { iconCategories, readIcons } from "../../../scripts/icons.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const iconsRoot = resolve(root, "../../icons");
const watch = process.argv.includes("--watch");
const categoryTitles = new Map(iconCategories.map(({ id, title }) => [id, title]));

await mkdir(dist, { recursive: true });

async function sortedIcons() {
  return (await readIcons()).sort((left, right) => left.name.localeCompare(right.name));
}

// Large literals parse faster as one JSON string than as a JavaScript object.
function jsonModule(value) {
  return `export default JSON.parse(${JSON.stringify(JSON.stringify(value))});`;
}

// Every normalized icon shares this root, so the bundle stores it once and only each icon's body.
const SVG_ROOT =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';

function svgBody({ name, svg }) {
  const source = svg.trim();
  if (!source.startsWith(SVG_ROOT) || !source.endsWith("</svg>")) {
    throw new Error(`icons/${name}.svg: expected the normalized root element; run bun run icons:optimize`);
  }
  return source.slice(SVG_ROOT.length, -"</svg>".length).trim();
}

// Deprecated Lucide names still found in older designs, mapped to the current
// name, so "Swap Lucide icons" recognizes layers such as `home` or `alert-circle`.
const lucideAliasesPath = resolve(root, "../vadivam-internal/src/data/lucide-deprecated-aliases.json");

// The canvas side needs SVG markup to create nodes plus the words for each component description.
async function createCatalogSource(icons) {
  const catalog = icons.map((icon) => ({
    name: icon.name,
    body: svgBody(icon),
    tags: icon.tags,
    categories: icon.categories.map((id) => categoryTitles.get(id)),
  }));
  const names = new Set(icons.map((icon) => icon.name));
  const aliases = Object.fromEntries(
    Object.entries(JSON.parse(await readFile(lucideAliasesPath, "utf8"))).filter(
      ([alias, name]) => !names.has(alias) && names.has(name),
    ),
  );
  return `export const svgRoot = ${JSON.stringify(SVG_ROOT)};\nexport const lucideAliases = ${JSON.stringify(aliases)};\n${jsonModule(catalog)}`;
}

// The UI only searches; previews come from the sprite already parsed with the HTML.
function createUiCatalogSource(icons) {
  return jsonModule({
    categories: iconCategories.map(({ id, title }) => [id, title]),
    icons: icons.map(({ name, tags, categories }) => [name, tags, categories]),
  });
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
}

// Built from validated geometry attributes only, never raw SVG text.
function createSprite(icons) {
  const symbols = icons.map(({ name, iconNode }) => {
    const shapes = iconNode
      .map(([tag, attributes]) => {
        const attrs = Object.entries(attributes)
          .filter(([attribute]) => attribute !== "key")
          .map(([attribute, value]) => ` ${attribute}="${escapeAttribute(value)}"`)
          .join("");
        return `<${tag}${attrs}/>`;
      })
      .join("");
    return `<symbol id="i-${name}" viewBox="0 0 24 24">${shapes}</symbol>`;
  });
  // `hidden` doesn't apply to SVG, so the sprite is zero-sized and out of the layout instead.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true" style="position:absolute">${symbols.join("")}</svg>`;
}

function virtualModulePlugin(specifier, filter, createSource) {
  return {
    name: specifier,
    setup(pluginBuild) {
      pluginBuild.onResolve({ filter }, () => ({ path: specifier, namespace: "vadivam" }));
      pluginBuild.onLoad({ filter: /.*/, namespace: "vadivam" }, async () => ({
        contents: await createSource(await sortedIcons()),
        loader: "js",
        watchDirs: [iconsRoot],
        watchFiles: [lucideAliasesPath],
      }));
    },
  };
}

const codeOptions = {
  entryPoints: [resolve(root, "src/code.ts")],
  bundle: true,
  outfile: resolve(dist, "code.js"),
  platform: "browser",
  target: ["es2019"],
  format: "iife",
  minify: !watch,
  plugins: [virtualModulePlugin("vadivam:catalog", /^vadivam:catalog$/, createCatalogSource)],
  logLevel: "info",
};

const uiOptions = {
  entryPoints: [resolve(root, "src/ui.ts")],
  bundle: true,
  outfile: resolve(dist, "ui.js"),
  platform: "browser",
  target: ["es2020"],
  format: "iife",
  minify: !watch,
  plugins: [virtualModulePlugin("vadivam:ui-catalog", /^vadivam:ui-catalog$/, createUiCatalogSource)],
  logLevel: "info",
};

async function buildHtml() {
  const [template, css, javascript, icons] = await Promise.all([
    readFile(resolve(root, "src/ui.html"), "utf8"),
    readFile(resolve(root, "src/ui.css"), "utf8"),
    readFile(resolve(dist, "ui.js"), "utf8"),
    sortedIcons(),
  ]);
  await writeFile(
    resolve(dist, "ui.html"),
    template
      .replace("<!-- INJECT_SPRITE -->", () => createSprite(icons))
      .replace("/* INJECT_UI_STYLES */", () => css)
      .replace("/* INJECT_UI_SCRIPT */", () => javascript),
  );
  return icons.length;
}

if (watch) {
  const codeContext = await context(codeOptions);
  const uiContext = await context({
    ...uiOptions,
    plugins: [
      ...uiOptions.plugins,
      {
        name: "rebuild-ui-html",
        setup(pluginBuild) {
          pluginBuild.onEnd(async (result) => {
            if (result.errors.length === 0) await buildHtml();
          });
        },
      },
    ],
  });
  await Promise.all([codeContext.watch(), uiContext.watch()]);
  console.log("[figma-plugin] watching for changes");
} else {
  await Promise.all([build(codeOptions), build(uiOptions)]);
  console.log(`[figma-plugin] built ${await buildHtml()} icons`);
}
