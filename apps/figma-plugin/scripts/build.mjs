import * as esbuild from "esbuild";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPlugin, jsonModule } from "../../figma-shared/build.mjs";
import { attributeString, canvasAttributes, styleIds, styles } from "../../../scripts/icon-styles.mjs";

// The UI only searches; previews come from the sprite already parsed with the HTML.
function uiCatalogModule({ icons, categories }) {
  return jsonModule({
    categories: categories.map(({ id, title }) => [id, title]),
    icons: icons.map(({ name, tags, categoryIds }) => [name, tags, categoryIds]),
  });
}

function escapeAttribute(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function shapes(iconNode) {
  return iconNode
    .map(([tag, attributes]) => {
      const attrs = Object.entries(attributes)
        .map(([attribute, value]) => ` ${attribute}="${escapeAttribute(value)}"`)
        .join("");
      return `<${tag}${attrs}/>`;
    })
    .join("");
}

// Built from validated geometry attributes only, never raw SVG text. The UI
// paints each preview for its style.
function sprite(icons) {
  const symbols = icons.flatMap((icon) =>
    styleIds.map((id) => {
      const attributes = attributeString({ id: `${styles[id].spriteIdPrefix}${icon.name}`, viewBox: canvasAttributes.viewBox });
      return `<symbol ${attributes}>${shapes(icon.styles[id].iconNode)}</symbol>`;
    }),
  );
  // `hidden` doesn't apply to SVG, so the sprite is zero-sized and out of the layout instead.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true" style="position:absolute">${symbols.join("")}</svg>`;
}

await buildPlugin({
  esbuild,
  name: "figma-plugin",
  root: resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  modules: { "vadivam:ui-catalog": uiCatalogModule },
  html: async (template, catalog) => {
    const { icons } = await catalog();
    return template.replace("<!-- INJECT_SPRITE -->", () => sprite(icons));
  },
});
