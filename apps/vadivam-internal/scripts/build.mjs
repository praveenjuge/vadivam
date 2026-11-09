import * as esbuild from "esbuild";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPlugin } from "../../figma-shared/build.mjs";
import { root as repositoryRoot, sourceDirectory } from "../../../scripts/icon-source.mjs";
import { isIconName, styles } from "../../../scripts/icon-styles.mjs";

const logo = path.join(repositoryRoot, "apps/docs/public/favicon.svg");

async function inlineSvg(file, className) {
  const svg = await readFile(file, "utf8");
  return svg.trim().replace("<svg ", `<svg class="${className}" aria-hidden="true" `);
}

// The UI draws with the canonical icons: <!-- icon:name --> becomes that
// outline SVG, and <!-- logo --> the site's mark.
async function injectSvgs(template) {
  const pattern = /<!-- icon:(\S+) -->/g;
  const names = [...new Set([...template.matchAll(pattern)].map((match) => match[1]))];
  const svgs = new Map(
    await Promise.all(
      names.map(async (name) => {
        if (!isIconName(name)) throw new Error(`ui.html: ${name} is not an icon name`);
        return [name, await inlineSvg(path.join(sourceDirectory(styles.outline), `${name}.svg`), "icon")];
      }),
    ),
  );
  const mark = await inlineSvg(logo, "logo");
  return template.replace(pattern, (_, name) => svgs.get(name)).replace("<!-- logo -->", () => mark);
}

await buildPlugin({
  esbuild,
  name: "vadivam-internal",
  root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  html: injectSvgs,
  htmlInputs: [logo],
});
