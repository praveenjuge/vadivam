// Builds a Figma plugin from the canonical icon source: `src/code.ts` becomes
// `dist/code.js`, and `src/ui.ts` is inlined with `src/ui.css` into
// `dist/ui.html`. Both plugins build through here; each passes its own
// esbuild, because this folder is not a package and has no node_modules.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  iconCategories,
  lucideAliasesFor,
  readIcons,
  root as repositoryRoot,
  sourceDirectory,
  validateStyleTwins,
} from "../../scripts/icon-source.mjs";
import { styleIds, styles, svgInner } from "../../scripts/icon-styles.mjs";

const categoryTitles = new Map(iconCategories.map(({ id, title }) => [id, title]));
const iconInputs = {
  watchDirs: styleIds.map((id) => sourceDirectory(styles[id])),
  watchFiles: ["lucide.json", "lucide-aliases.json"].map((file) => path.join(repositoryRoot, "metadata", file)),
};

// Both plugins list icons A–Z by name. `readIcons` returns them in file-name
// order instead, which puts `alarm-clock-check.svg` before `alarm-clock.svg`.
const byName = (left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0);

/** Every icon, A–Z by name, with its drawing in each style. */
export async function loadCatalog() {
  const byStyle = await Promise.all(styleIds.map((id) => readIcons(styles[id])));
  validateStyleTwins(Object.fromEntries(styleIds.map((id, index) => [id, byStyle[index].map((icon) => icon.name)])));
  const twins = byStyle.map((icons) => new Map(icons.map((icon) => [icon.name, icon])));
  const icons = [...byStyle[0]].sort(byName).map(({ name, tags, categories }) => ({
    name,
    tags,
    categoryIds: categories,
    categories: categories.map((id) => categoryTitles.get(id)),
    styles: Object.fromEntries(styleIds.map((id, index) => [id, twins[index].get(name)])),
  }));
  // Awaited because it may reread metadata/lucide-aliases.json for each rebuild.
  const lucideAliases = await lucideAliasesFor(icons.map((icon) => icon.name));
  return { icons, categories: iconCategories, lucideAliases };
}

// Large literals parse faster as one JSON string than as a JavaScript object.
export function jsonModule(value) {
  return `export default JSON.parse(${JSON.stringify(JSON.stringify(value))});`;
}

// The main thread needs each icon's markup to create nodes, and its words for
// component descriptions. Every icon of a style shares one root element, so
// only the markup inside it is stored.
function catalogModule({ icons, lucideAliases }) {
  const entries = icons.map(({ name, tags, categories, styles: twins }) => ({
    name,
    tags,
    categories,
    bodies: Object.fromEntries(styleIds.map((id) => [id, svgInner(twins[id].svg)])),
  }));
  return `export const lucideAliases = ${JSON.stringify(lucideAliases)};\n${jsonModule(entries)}`;
}

// One catalog per build of a bundle, read again on every rebuild.
function catalogLoader() {
  let pending;
  return {
    reset: () => {
      pending = undefined;
    },
    load: () => (pending ??= loadCatalog()),
  };
}

function iconModulesPlugin(modules, catalog) {
  return {
    name: "vadivam-icon-modules",
    setup(build) {
      build.onStart(catalog.reset);
      build.onResolve({ filter: /^vadivam:/ }, ({ path: specifier }) =>
        modules.has(specifier) ? { path: specifier, namespace: "vadivam" } : undefined,
      );
      build.onLoad({ filter: /.*/, namespace: "vadivam" }, async ({ path: specifier }) => ({
        contents: modules.get(specifier)(await catalog.load()),
        loader: "js",
        ...iconInputs,
      }));
    },
  };
}

// Writes dist/ui.html after every UI build. The entry point's load also
// registers the HTML template and stylesheet, so watch mode rebuilds when
// either changes, not only when the script does.
function uiHtmlPlugin({ name, root, dist, html, htmlInputs, watch, catalog }) {
  const template = path.join(root, "src/ui.html");
  const stylesheet = path.join(root, "src/ui.css");
  return {
    name: "vadivam-ui-html",
    setup(build) {
      build.onLoad({ filter: /[\\/]src[\\/]ui\.ts$/ }, async ({ path: entry }) => ({
        contents: await readFile(entry, "utf8"),
        loader: "ts",
        watchFiles: [template, stylesheet, ...iconInputs.watchFiles, ...htmlInputs],
        watchDirs: iconInputs.watchDirs,
      }));
      build.onEnd(async (result) => {
        if (result.errors.length > 0) return;
        const javascript = result.outputFiles.find((file) => file.path.endsWith(".js")).text;
        const [markup, css] = await Promise.all([
          readFile(template, "utf8").then((text) => html(text, catalog.load)),
          readFile(stylesheet, "utf8"),
        ]);
        await writeFile(
          path.join(dist, "ui.html"),
          markup.replace("/* INJECT_UI_STYLES */", () => css).replace("/* INJECT_UI_SCRIPT */", () => javascript),
        );
        if (watch) console.log(`[${name}] wrote dist/ui.html`);
      });
    },
  };
}

/**
 * @param {object} options
 * @param {typeof import("esbuild")} options.esbuild
 * @param {string} options.name Log prefix.
 * @param {string} options.root The plugin folder.
 * @param {Record<string, (catalog: Awaited<ReturnType<typeof loadCatalog>>) => string>} [options.modules]
 *   Extra `vadivam:` modules beside `vadivam:catalog`, built from the catalog.
 * @param {(template: string, catalog: () => ReturnType<typeof loadCatalog>) => string | Promise<string>} [options.html]
 *   Fills the UI template's own placeholders.
 * @param {string[]} [options.htmlInputs] Files `html` reads, so watch mode rebuilds when they change.
 */
export async function buildPlugin({ esbuild, name, root, modules = {}, html = (template) => template, htmlInputs = [] }) {
  const watch = process.argv.includes("--watch");
  const dist = path.join(root, "dist");
  await mkdir(dist, { recursive: true });
  const iconModules = new Map(Object.entries({ "vadivam:catalog": catalogModule, ...modules }));
  const uiCatalog = catalogLoader();
  const shared = { bundle: true, platform: "browser", format: "iife", minify: !watch, logLevel: "info" };
  const codeOptions = {
    ...shared,
    entryPoints: [path.join(root, "src/code.ts")],
    outfile: path.join(dist, "code.js"),
    target: ["es2019"],
    plugins: [iconModulesPlugin(iconModules, catalogLoader())],
  };
  const uiOptions = {
    ...shared,
    entryPoints: [path.join(root, "src/ui.ts")],
    outfile: path.join(dist, "ui.js"),
    target: ["es2020"],
    write: false,
    plugins: [
      iconModulesPlugin(iconModules, uiCatalog),
      uiHtmlPlugin({ name, root, dist, html, htmlInputs, watch, catalog: uiCatalog }),
    ],
  };

  if (watch) {
    const contexts = await Promise.all([esbuild.context(codeOptions), esbuild.context(uiOptions)]);
    await Promise.all(contexts.map((context) => context.watch()));
    console.log(`[${name}] watching for changes`);
  } else {
    await Promise.all([esbuild.build(codeOptions), esbuild.build(uiOptions)]);
    console.log(`[${name}] build complete`);
  }
}
