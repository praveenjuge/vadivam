import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { styles } from "../icon-styles.mjs";
import { iconCategories, root, sourceDirectory } from "../icon-source.mjs";
import { iconDataDir, iconDataFiles } from "../web-data.mjs";

const webRoot = path.join(root, "apps/docs/public");

// The docs site serves each style's SVGs under its source folder's name, plus
// the homepage's lazily loaded search index and solid path chunks.
export async function buildWebAssets({ icons, solidIcons }) {
  for (const [style, styleIcons] of [[styles.outline, icons], [styles.solid, solidIcons]]) {
    const directory = path.join(webRoot, style.sourceDirectory);
    await rm(directory, { recursive: true, force: true });
    await mkdir(directory, { recursive: true });
    for (const icon of styleIcons) {
      await copyFile(path.join(sourceDirectory(style), icon.fileName), path.join(directory, icon.fileName));
    }
  }
  const dataDirectory = path.join(webRoot, iconDataDir);
  await rm(dataDirectory, { recursive: true, force: true });
  await mkdir(dataDirectory, { recursive: true });
  const solidByName = new Map(solidIcons.map((icon) => [icon.name, icon]));
  const { searchIndex, solidChunks } = iconDataFiles(
    icons.map((icon) => ({ ...icon, solid: solidByName.get(icon.name) })),
    iconCategories,
  );
  for (const file of [searchIndex, ...solidChunks]) {
    await writeFile(path.join(webRoot, file.path), file.contents);
  }
}
