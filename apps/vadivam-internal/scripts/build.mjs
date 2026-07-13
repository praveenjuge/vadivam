import { build, context } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const watch = process.argv.includes("--watch");

await mkdir(dist, { recursive: true });

const codeOptions = {
  entryPoints: [resolve(root, "src/code.ts")],
  bundle: true,
  outfile: resolve(dist, "code.js"),
  platform: "browser",
  target: ["es2019"],
  format: "iife",
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

async function buildHtml() {
  const [template, css, javascript] = await Promise.all([
    readFile(resolve(root, "src/ui.html"), "utf8"),
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
