// The canonical icons and the exact sprite.svg the npm package publishes,
// built from this checkout's icons/ so tests never need a prior package build.
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readIcons } from "../../../scripts/icons.mjs";
import { buildSprite } from "../../../scripts/generators/static.mjs";

export async function canonicalIcons() {
  return (await readIcons()).map(({ name, svg }) => ({ name, svg }));
}

export async function publishedSprite() {
  const directory = await mkdtemp(path.join(tmpdir(), "vadivam-sprite-"));
  try {
    const file = path.join(directory, "sprite.svg");
    await buildSprite(await readIcons(), file);
    return await readFile(file, "utf8");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
