import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { styles } from "../icon-styles.mjs";
import { iconCategories, sourceDirectory } from "../icon-source.mjs";
import { docsPublicDirectory } from "../lib/paths.mjs";
import { iconDataDir, iconDataFiles } from "../web-data.mjs";

// The docs site serves each style's SVGs under its source folder's name, plus
// the homepage's lazily loaded search index and solid path chunks.
export async function buildWebAssets(iconsByStyle) {
  for (const style of Object.values(styles)) {
    const directory = path.join(docsPublicDirectory, style.sourceDirectory);
    await rm(directory, { recursive: true, force: true });
    await mkdir(directory, { recursive: true });
    for (const icon of iconsByStyle[style.id]) {
      await copyFile(path.join(sourceDirectory(style), icon.fileName), path.join(directory, icon.fileName));
    }
  }
  const dataDirectory = path.join(docsPublicDirectory, iconDataDir);
  await rm(dataDirectory, { recursive: true, force: true });
  await mkdir(dataDirectory, { recursive: true });
  const solidByName = new Map(iconsByStyle.solid.map((icon) => [icon.name, icon]));
  const { searchIndex, solidChunks } = iconDataFiles(
    iconsByStyle.outline.map((icon) => ({ ...icon, solid: solidByName.get(icon.name) })),
    iconCategories,
  );
  for (const file of [searchIndex, ...solidChunks]) {
    await writeFile(path.join(docsPublicDirectory, file.path), file.contents);
  }
}
