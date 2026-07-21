import { build, context } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readIcons } from "../../../scripts/icons.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const watch = process.argv.includes("--watch");

await mkdir(dist, { recursive: true });

const sourceIcons = await readIcons();
const catalogSource = `export default ${JSON.stringify(
  sourceIcons
    .map(({ name, svg }) => ({ name, svg }))
    .sort((left, right) => left.name.localeCompare(right.name)),
)};`;

const catalogPlugin = {
  name: "vadivam-catalog",
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^vadivam:catalog$/ }, () => ({
      path: "catalog",
      namespace: "vadivam",
    }));
    pluginBuild.onLoad({ filter: /.*/, namespace: "vadivam" }, () => ({
      contents: catalogSource,
      loader: "js",
    }));
  },
};

const codeOptions = {
  entryPoints: [resolve(root, "src/code.ts")],
  bundle: true,
  outfile: resolve(dist, "code.js"),
  platform: "browser",
  target: ["es2019"],
  format: "iife",
  minify: !watch,
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
  minify: !watch,
  logLevel: "info",
};

async function buildHtml() {
  const [template, css, javascript] = await Promise.all([
    readFile(resolve(root, "src/ui.html"), "utf8"),
    readFile(resolve(root, "src/ui.css"), "utf8"),
    readFile(resolve(dist, "ui.js"), "utf8"),
  ]);
  await writeFile(
    resolve(dist, "ui.html"),
    template
      .replace("/* INJECT_UI_STYLES */", css)
      .replace("/* INJECT_UI_SCRIPT */", javascript),
  );
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
  console.log("[figma-plugin] watching for changes");
} else {
  await Promise.all([build(codeOptions), build(uiOptions)]);
  await buildHtml();
  console.log(`[figma-plugin] built ${sourceIcons.length} icons`);
}
