import { build, context } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { iconCategories, readIcons, styles } from "../../../scripts/icons.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const iconsRoot = resolve(root, "../../icons");
const solidIconsRoot = resolve(root, "../../icons-solid");
const watch = process.argv.includes("--watch");
const categoryTitles = new Map(iconCategories.map(({ id, title }) => [id, title]));

function createCatalogSource(icons, solidIcons) {
  const solid = new Map(solidIcons.map((icon) => [icon.name, icon.svg]));
  return `export default ${JSON.stringify(
    icons
      .map(({ name, svg, tags, categories }) => ({
        name,
        svg,
        solidSvg: solid.get(name),
        tags,
        categories: categories.map((id) => categoryTitles.get(id)),
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  )};`;
}

const catalogPlugin = {
  name: "vadivam-icon-catalog",
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^vadivam:icon-catalog$/ }, () => ({
      path: "icon-catalog",
      namespace: "vadivam",
    }));
    pluginBuild.onLoad({ filter: /.*/, namespace: "vadivam" }, async () => ({
      contents: createCatalogSource(await readIcons(), await readIcons(styles.solid)),
      loader: "js",
      watchDirs: [iconsRoot, solidIconsRoot],
    }));
  },
};

await mkdir(dist, { recursive: true });

const codeOptions = {
  entryPoints: [resolve(root, "src/code.ts")],
  bundle: true,
  outfile: resolve(dist, "code.js"),
  platform: "browser",
  target: ["es2019"],
  format: "iife",
  plugins: [catalogPlugin],
  logLevel: "info",
};

const uiOptions = {
  entryPoints: [resolve(root, "src/ui.ts")],
  bundle: true,
  outfile: resolve(dist, "ui.js"),
  platform: "browser",
  target: ["es2020"],
  format: "iife",
  logLevel: "info",
};

// The UI draws its own icons from the canonical set: <!-- icon:name --> becomes that SVG.
async function injectIcons(template) {
  const pattern = /<!-- icon:([a-z0-9-]+) -->/g;
  const names = [...new Set([...template.matchAll(pattern)].map((match) => match[1]))];
  const svgs = new Map(
    await Promise.all(
      names.map(async (name) => {
        const svg = await readFile(resolve(iconsRoot, `${name}.svg`), "utf8");
        return [name, svg.trim().replace("<svg ", '<svg class="icon" aria-hidden="true" ')];
      }),
    ),
  );
  return template.replace(pattern, (_, name) => svgs.get(name));
}

async function buildHtml() {
  const [template, css, javascript] = await Promise.all([
    readFile(resolve(root, "src/ui.html"), "utf8").then(injectIcons),
    readFile(resolve(root, "src/ui.css"), "utf8"),
    readFile(resolve(dist, "ui.js"), "utf8"),
  ]);
  const html = template
    .replace("/* INJECT_UI_STYLES */", css)
    .replace("/* INJECT_UI_SCRIPT */", javascript);
  await writeFile(resolve(dist, "ui.html"), html);
}

if (watch) {
  const codeContext = await context(codeOptions);
  const uiContext = await context({
    ...uiOptions,
    plugins: [
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
  console.log("[vadivam-internal] watching for changes");
} else {
  await Promise.all([build(codeOptions), build(uiOptions)]);
  await buildHtml();
  console.log("[vadivam-internal] build complete");
}
