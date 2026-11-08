// The README preview and the social card, rendered from the outline icons.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { canvasSize, svgInner } from "../icon-styles.mjs";
import { readIcons, root } from "../icon-source.mjs";

export const previewPath = path.join(root, "apps/docs/public/preview.png");
export const ogPath = path.join(root, "apps/docs/public/og.png");

export async function buildPreview() {
  const icons = await readIcons();
  // A fixed column count keeps the width readable in README columns as the set grows.
  const columns = 30;
  const cell = 32;
  const padding = 32;
  const gap = 24;
  const scale = 2;
  const strokeWidth = 2.25;
  const rows = Math.max(1, Math.ceil(icons.length / columns));
  const width = padding * 2 + columns * cell + (columns - 1) * gap;
  const height = padding * 2 + rows * cell + (rows - 1) * gap;
  const tiles = icons
    .map((icon, i) => {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const x = padding + col * (cell + gap);
      const y = padding + row * (cell + gap);
      return `<g transform="translate(${x} ${y}) scale(${cell / canvasSize})">${svgInner(icon.svg)}</g>`;
    })
    .join("");
  const composite = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" stroke="#000000" stroke-width="${(strokeWidth * canvasSize) / cell}" stroke-linecap="round" stroke-linejoin="round"><rect width="${width}" height="${height}" fill="#ffffff" stroke="none"/>${tiles}</svg>`;
  const png = new Resvg(composite, {
    fitTo: { mode: "width", value: width * scale },
    background: "#ffffff",
  })
    .render()
    .asPng();
  await mkdir(path.dirname(previewPath), { recursive: true });
  await writeFile(previewPath, png);
  console.log(
    `Wrote ${path.relative(root, previewPath)} (${icons.length} icons, ${columns}x${rows}, ${width * scale}x${height * scale}).`,
  );
}

function fnv1aHash(value) {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < value.length; i++) {
    hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleUnique(items, random) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export async function buildOg() {
  const icons = await readIcons();
  if (icons.length === 0) throw new Error("buildOg: no icons available");

  const width = 1200;
  const height = 630;
  const targetIconSize = 40;
  const targetGap = 24;
  const targetStep = targetIconSize + targetGap;
  const angle = -22;

  const innerSvgs = icons.map((icon) => svgInner(icon.svg));

  const seed = fnv1aHash(icons.map((icon) => icon.name).join(","));
  const random = mulberry32(seed);

  // Match the grid to the rotated canvas bounds so more unique icons remain
  // visible instead of being cropped out by an oversized square grid.
  const radians = (Math.abs(angle) * Math.PI) / 180;
  const coverWidth =
    Math.ceil(width * Math.cos(radians) + height * Math.sin(radians)) +
    targetStep * 2;
  const coverHeight =
    Math.ceil(width * Math.sin(radians) + height * Math.cos(radians)) +
    targetStep * 2;
  const aspect = coverWidth / coverHeight;
  const rows = Math.max(1, Math.ceil(Math.sqrt(icons.length / aspect)));
  const columns = Math.ceil(icons.length / rows);
  const stepX = coverWidth / columns;
  const stepY = coverHeight / rows;
  const iconSize = Math.min(stepX, stepY) * (targetIconSize / targetStep);
  const offsetX = -coverWidth / 2;
  const offsetY = -coverHeight / 2;
  const scale = iconSize / canvasSize;
  const positions = Array.from({ length: rows * columns }, (_, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    return {
      index,
      x: offsetX + col * stepX,
      y: offsetY + row * stepY,
      distance: Math.hypot(col - (columns - 1) / 2, row - (rows - 1) / 2),
    };
  });
  const skippedPositions = new Set(
    [...positions]
      .sort((a, b) => b.distance - a.distance || b.index - a.index)
      .slice(0, positions.length - icons.length)
      .map((position) => position.index),
  );
  const visiblePositions = positions.filter(
    (position) => !skippedPositions.has(position.index),
  );
  const uniqueSvgs = shuffleUnique(innerSvgs, random);
  const tiles = visiblePositions.map(
    ({ x, y }, index) =>
      `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(4)})">${uniqueSvgs[index]}</g>`,
  );

  const composite = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" stroke-linecap="round" stroke-linejoin="round">
<rect width="${width}" height="${height}" fill="#ffffff"/>
<g transform="translate(${width / 2} ${height / 2}) rotate(${angle})" stroke="#111111" stroke-width="1.5">${tiles.join("")}</g>
</svg>`;

  const png = new Resvg(composite, {
    fitTo: { mode: "width", value: width },
    background: "#ffffff",
  })
    .render()
    .asPng();
  await mkdir(path.dirname(ogPath), { recursive: true });
  await writeFile(ogPath, png);
  console.log(
    `Wrote ${path.relative(root, ogPath)} (${icons.length} unique icons, ${tiles.length} tiles, ${width}x${height}).`,
  );
}

