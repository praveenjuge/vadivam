// The canonical icons of a style and the exact sprite.svg the npm package
// publishes for it, built from this checkout so tests never need a package build.
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readIcons } from "../../../scripts/icon-source.mjs";
import { buildSprite } from "../../../scripts/generators/static.mjs";
import { styles } from "../../../scripts/icon-styles.mjs";

export async function canonicalIcons(style) {
  return (await readIcons(styles[style])).map(({ name, svg }) => ({ name, svg }));
}

export async function publishedSprite(style) {
  const directory = await mkdtemp(path.join(tmpdir(), "vadivam-sprite-"));
  try {
    const file = path.join(directory, "sprite.svg");
    await buildSprite(await readIcons(styles[style]), file, styles[style]);
    return await readFile(file, "utf8");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
