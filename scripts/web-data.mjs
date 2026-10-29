import { createHash } from "node:crypto";

// The homepage grid groups its tiles in chunks of this many icons. 120 divides
// every column count the grid uses (5, 8, 10, 24), so chunks stack without
// ragged rows, and the solid paths load one chunk at a time to match.
export const gridChunkSize = 120;

// Data the homepage fetches on demand, served from `/icon-data/` under
// content-hashed names so browsers can cache each file for good.
export const iconDataDir = "icon-data";

const hashedFile = (name, data) => {
  const contents = JSON.stringify(data);
  const hash = createHash("sha256").update(contents).digest("hex").slice(0, 10);
  return { path: `${iconDataDir}/${name}.${hash}.json`, contents };
};

/**
 * The homepage's lazily loaded data, from manifest-shaped icons in grid order:
 * one search index of tags and categories, and the solid path data for each
 * grid chunk as an array of path lists in tile order. `scripts/icons.mjs`
 * writes these files and the homepage derives the same names, so the two
 * always agree.
 */
export function iconDataFiles(icons, categories) {
  const searchIndex = hashedFile("search", {
    categories: Object.fromEntries(categories.map(({ id, title }) => [id, title])),
    icons: icons.map((icon) => [icon.name, icon.tags, icon.categories.join(" ")]),
  });
  const solidChunks = [];
  for (let start = 0; start < icons.length; start += gridChunkSize) {
    const chunk = icons.slice(start, start + gridChunkSize);
    solidChunks.push(
      hashedFile(
        `solid-${solidChunks.length}`,
        chunk.map((icon) => {
          if (!icon.solid) throw new Error(`${icon.name} has no solid twin`);
          return icon.solid.iconNode.map(([, attributes]) => attributes.d);
        }),
      ),
    );
  }
  return { searchIndex, solidChunks };
}
