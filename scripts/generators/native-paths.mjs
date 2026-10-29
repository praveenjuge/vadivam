import { parsePath, serializePath } from "../icon-geometry.mjs";

// Native packages draw from absolute M, L, C, Q, A, and Z commands, which every
// Vadivam path normalizes to. Coordinates keep four decimals, well past what a
// 24px view box can show.
export function round(value) {
  const rounded = Math.round(value * 1e4) / 1e4;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function iconSubpaths(icon) {
  return icon.iconNode.flatMap(([tag, attrs]) => {
    if (tag !== "path") throw new Error(`${icon.name}: native packages support <path> only, found <${tag}>`);
    return parsePath(attrs.d);
  });
}

export function iconPathData(icon) {
  return serializePath(iconSubpaths(icon));
}

export function camelCase(name) {
  return name.replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase());
}
