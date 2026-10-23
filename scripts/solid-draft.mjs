// Drafts a solid icon from its outline twin with Skia's path ops. Drafts are a
// starting point for the Figma pass, not the source of truth: once a file is in
// icons-solid/, it is edited there and never regenerated unless asked.
//
// The rules follow the design guide's Solid section:
// - closed shapes fill out to the outline's ink edge (centerline + 1px);
// - a closed shape inside a filled one is knocked out, and one inside that is
//   filled again;
// - lines inside a fill are cut out at 2px;
// - lines outside any fill stay ink at 2.5px, with a 2px gap cut around them
//   where they stood apart from the rest of the drawing;
// - an "-off" icon is its base icon's solid with the slash cut through it.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export const solidLineWidth = 2.5;
export const cutWidth = 2;
export const gap = 2;

// Skia's stroker and path ops work to a fixed absolute tolerance, which is
// coarse on a 24px canvas, so every path is worked on at this scale.
const scale = 64;

let pathKit;
export async function loadPathKit() {
  if (pathKit) return pathKit;
  const init = require("pathkit-wasm/bin/pathkit.js");
  const wasmBinary = readFileSync(require.resolve("pathkit-wasm/bin/pathkit.wasm"));
  pathKit = await init({ wasmBinary });
  return pathKit;
}

const MOVE = 0;
const LINE = 1;
const QUAD = 2;
const CONIC = 3;
const CUBIC = 4;
const CLOSE = 5;

function point(cmd) {
  return [cmd[cmd.length - (cmd[0] === CONIC ? 3 : 2)], cmd[cmd.length - (cmd[0] === CONIC ? 2 : 1)]];
}

// Samples every contour of a command list into polylines.
function flatten(cmds, steps = 12) {
  const contours = [];
  let current = null;
  let last = [0, 0];
  let start = [0, 0];
  for (const cmd of cmds) {
    const verb = cmd[0];
    if (verb === MOVE) {
      current = [[cmd[1], cmd[2]]];
      contours.push(current);
      last = start = [cmd[1], cmd[2]];
      continue;
    }
    if (verb === CLOSE) {
      if (current) current.closed = true;
      last = start;
      continue;
    }
    if (!current) {
      current = [last];
      contours.push(current);
    }
    if (verb === LINE) current.push([cmd[1], cmd[2]]);
    else {
      for (let i = 1; i <= steps; i += 1) {
        const t = i / steps;
        const u = 1 - t;
        if (verb === QUAD) {
          current.push([
            u * u * last[0] + 2 * u * t * cmd[1] + t * t * cmd[3],
            u * u * last[1] + 2 * u * t * cmd[2] + t * t * cmd[4],
          ]);
        } else if (verb === CONIC) {
          const w = cmd[5];
          const d = u * u + 2 * w * u * t + t * t;
          current.push([
            (u * u * last[0] + 2 * w * u * t * cmd[1] + t * t * cmd[3]) / d,
            (u * u * last[1] + 2 * w * u * t * cmd[2] + t * t * cmd[4]) / d,
          ]);
        } else if (verb === CUBIC) {
          current.push([
            u ** 3 * last[0] + 3 * u * u * t * cmd[1] + 3 * u * t * t * cmd[3] + t ** 3 * cmd[5],
            u ** 3 * last[1] + 3 * u * u * t * cmd[2] + 3 * u * t * t * cmd[4] + t ** 3 * cmd[6],
          ]);
        }
      }
    }
    last = point(cmd);
  }
  return contours;
}

function polygonArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

function polylineLength(points) {
  let length = 0;
  for (let i = 1; i < points.length; i += 1)
    length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return length;
}

function insidePolygon([x, y], points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Skia's simplify and path ops return even-odd paths whose contours all wind
// the same way, so a contour's role comes from how deeply it is nested: even
// depths are filled, odd depths are holes.
function contourDepths(contours) {
  return contours.map((contour, index) => {
    const probe = contour[0];
    return contours.filter((other, otherIndex) => otherIndex !== index && insidePolygon(probe, other)).length;
  });
}

// The filled area of a simplified path.
export function area(path) {
  if (!path) return 0;
  const contours = flatten(path.toCmds()).filter((contour) => contour.length > 2);
  const depths = contourDepths(contours);
  const total = contours.reduce(
    (sum, contour, index) => sum + (depths[index] % 2 === 0 ? 1 : -1) * Math.abs(polygonArea(contour)),
    0,
  );
  return Math.max(0, total) / scale ** 2;
}

function makeOps(PK) {
  const empty = () => new PK.SkPath();
  const op = (a, b, kind) => PK.MakeFromOp(a ?? empty(), b ?? empty(), kind) ?? empty();
  return {
    empty,
    union: (a, b) => op(a, b, PK.PathOp.UNION),
    difference: (a, b) => op(a, b, PK.PathOp.DIFFERENCE),
    intersect: (a, b) => op(a, b, PK.PathOp.INTERSECT),
    stroke: (path, width) => {
      const stroked = path.copy().stroke({
        width: width * scale,
        join: PK.StrokeJoin.ROUND,
        cap: PK.StrokeCap.ROUND,
      });
      return (stroked ?? empty()).simplify() ?? empty();
    },
    fill: (path) => {
      const filled = path.copy();
      filled.close?.();
      filled.setFillType(PK.FillType.WINDING);
      return filled.simplify() ?? empty();
    },
  };
}

// Splits path data into subpaths, each with its sampled centerline.
export function subpaths(PK, pathData) {
  const result = [];
  for (const d of pathData) {
    const cmds = PK.FromSVGString(d).toCmds();
    let current = null;
    for (const cmd of cmds) {
      if (cmd[0] === MOVE) {
        current = [cmd];
        result.push(current);
      } else current?.push(cmd);
    }
  }
  return result
    .filter((cmds) => cmds.length > 1)
    .map((cmds, index) => {
      const path = PK.FromCmds(cmds).transform(scale, 0, 0, 0, scale, 0, 0, 0, 1);
      const [line] = flatten(cmds);
      const first = line[0];
      const end = line[line.length - 1];
      const explicit = cmds.some((cmd) => cmd[0] === CLOSE);
      const closed = explicit || Math.hypot(first[0] - end[0], first[1] - end[1]) < 0.05;
      return { index, cmds, path, line, closed, length: polylineLength(line) };
    });
}

function isStraight(sub) {
  return sub.cmds.length === 2 && sub.cmds[1][0] === LINE;
}

function hasCurve(sub) {
  return sub.cmds.some((cmd) => cmd[0] === QUAD || cmd[0] === CONIC || cmd[0] === CUBIC);
}

// A dome is an open curve whose ends sit level and which bulges well away from
// the line between them, such as a person's shoulders. It is filled as if
// closed by that line.
function isDome(sub) {
  if (sub.closed || !hasCurve(sub) || sharpestTurn(sub) > 30) return false;
  const first = sub.line[0];
  const end = sub.line[sub.line.length - 1];
  const dx = end[0] - first[0];
  const dy = end[1] - first[1];
  const chord = Math.hypot(dx, dy);
  if (chord < 6 || Math.abs(dy) > 0.5) return false;
  // Only domes that rise above their ends, like shoulders; a bowl or a U
  // stays a line.
  if (sub.line.some(([, y]) => y > first[1] + 0.5)) return false;
  let min = Infinity;
  let max = -Infinity;
  for (const [x, y] of sub.line) {
    const side = ((x - first[0]) * dy - (y - first[1]) * dx) / chord;
    min = Math.min(min, side);
    max = Math.max(max, side);
  }
  const height = Math.max(Math.abs(min), Math.abs(max));
  const oneSided = Math.min(Math.abs(min), Math.abs(max)) < 0.5;
  return oneSided && height / chord >= 0.35;
}

// The sharpest change of direction along a subpath, in degrees.
function sharpestTurn(sub) {
  let sharpest = 0;
  let previous;
  for (let i = 1; i < sub.line.length; i += 1) {
    const [x1, y1] = sub.line[i - 1];
    const [x2, y2] = sub.line[i];
    if (Math.hypot(x2 - x1, y2 - y1) < 1e-6) continue;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    if (previous !== undefined) {
      let delta = Math.abs(angle - previous);
      if (delta > Math.PI) delta = 2 * Math.PI - delta;
      sharpest = Math.max(sharpest, (delta * 180) / Math.PI);
    }
    previous = angle;
  }
  return sharpest;
}

function distanceToLine(point, line) {
  let best = Infinity;
  for (let i = 1; i < line.length; i += 1) {
    const [x1, y1] = line[i - 1];
    const [x2, y2] = line[i];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared ? Math.max(0, Math.min(1, ((point[0] - x1) * dx + (point[1] - y1) * dy) / lengthSquared)) : 0;
    best = Math.min(best, Math.hypot(point[0] - x1 - t * dx, point[1] - y1 - t * dy));
  }
  return best;
}

// An open shape whose two ends stop on another shape's line is drawn behind
// that shape, like the back page of copy.
function isBehind(sub, subs) {
  if (sub.closed) return false;
  const ends = [sub.line[0], sub.line[sub.line.length - 1]];
  return subs.some((other) => other !== sub && ends.every((end) => distanceToLine(end, other.line) < 0.75));
}

// An open curve whose ends touch nothing else, unlike an arrow's arc, which
// ends on its arrowhead.
function hasFreeEnds(sub, subs) {
  const ends = [sub.line[0], sub.line[sub.line.length - 1]];
  return subs.every((other) => other === sub || ends.every((end) => distanceToLine(end, other.line) >= 1));
}

// How far an open curve turns, in degrees, such as the 270° of a circle
// drawn with a gap.
function turning(sub) {
  let total = 0;
  let previous;
  for (let i = 1; i < sub.line.length; i += 1) {
    const [x1, y1] = sub.line[i - 1];
    const [x2, y2] = sub.line[i];
    if (Math.hypot(x2 - x1, y2 - y1) < 1e-6) continue;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    if (previous !== undefined) {
      let delta = angle - previous;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      total += delta;
    }
    previous = angle;
  }
  return Math.abs((total * 180) / Math.PI);
}

// The ink with every hole it encloses filled in: only its outermost contours.
function fillHoles(PK, path) {
  const contours = [];
  for (const cmd of path.toCmds()) {
    if (cmd[0] === MOVE) contours.push([cmd]);
    else contours.at(-1)?.push(cmd);
  }
  const polygons = contours.map((cmds) => flatten(cmds)[0] ?? []);
  const depths = contourDepths(polygons);
  const kept = contours.filter((_, index) => depths[index] === 0 && polygons[index].length > 2).flat();
  const filled = PK.FromCmds(kept);
  filled.setFillType(PK.FillType.WINDING);
  return filled.simplify() ?? filled;
}

// The slash of an "-off" icon: the longest straight diagonal line.
function findSlash(subs) {
  return subs
    .filter((sub) => isStraight(sub))
    .filter((sub) => {
      const [[x1, y1], [x2, y2]] = sub.line;
      const dx = Math.abs(x2 - x1);
      const dy = Math.abs(y2 - y1);
      return dx > 8 && dy > 8 && Math.abs(dx - dy) < 1;
    })
    .sort((a, b) => b.length - a.length)[0];
}

export function pathDataOf(svg) {
  return [...svg.matchAll(/<path\b[^>]*\sd="([^"]*)"/g)].map((match) => match[1]);
}

// Builds the solid draft as a Skia path. `base` is the solid path of the
// icon this one switches off, when there is one. Hints come from
// metadata/solid-hints.json: `mode: "line"` keeps a typographic icon as 2.5px
// lines, `mode: "letters"` cuts letters inside a frame out as lines, and
// `fill` and `line` force single subpaths by index.
export function draftSolid(PK, pathData, { base, hints = {} } = {}) {
  const ops = makeOps(PK);
  const subs = subpaths(PK, pathData);
  const slashOnly = Boolean(base);
  if (slashOnly) {
    const slash = findSlash(subs);
    if (slash) {
      const cleared = ops.difference(base, ops.stroke(slash.path, solidLineWidth + 2 * gap));
      return ops.union(cleared, ops.stroke(slash.path, solidLineWidth));
    }
  }

  const fillIndexes = new Set(hints.fill ?? []);
  const lineIndexes = new Set(hints.line ?? []);
  for (const sub of subs) {
    sub.ink = ops.stroke(sub.path, 2);
    if (hints.mode === "line" || lineIndexes.has(sub.index)) continue;
    const gappedCircle = subs.length > 1 && turning(sub) >= 240 && hasFreeEnds(sub, subs);
    if (sub.closed || isDome(sub) || fillIndexes.has(sub.index) || gappedCircle) {
      sub.fillable = true;
      sub.region = ops.fill(sub.path);
      sub.silhouette = ops.union(sub.region, sub.ink);
    } else {
      // An open stroke that loops back on itself, such as a bell drawn in one
      // line, fills the area it encloses. Its strokes that run inside that
      // area, such as an envelope's flap, are cut out like any inner line.
      const enclosed = fillHoles(PK, sub.ink);
      if (area(enclosed) - area(sub.ink) > 2) {
        sub.fillable = true;
        sub.region = enclosed;
        sub.silhouette = enclosed;
        // The outer stroke reaches 2px in from the edge; what lies beyond is inner.
        const inner = ops.difference(sub.ink, ops.stroke(enclosed, 2 * gap + 0.5));
        if (area(inner) > 1) sub.cut = inner;
      }
    }
    if (sub.fillable) sub.area = area(sub.silhouette);
  }
  let fillables = subs.filter((sub) => sub.fillable);
  for (const sub of fillables) {
    sub.depth = fillables.filter(
      (other) =>
        other !== sub &&
        other.area > sub.area &&
        area(ops.difference(sub.silhouette, other.region)) < 0.05 * sub.area,
    ).length;
  }
  if (hints.mode === "letters") {
    for (const sub of fillables) if (sub.depth > 0 && !fillIndexes.has(sub.index)) sub.fillable = false;
    fillables = fillables.filter((sub) => sub.fillable);
  }

  // Outline ink drawn so far, to tell which lines stood apart.
  let outlineInk = ops.empty();
  const apart = (sub) => area(ops.intersect(ops.stroke(sub.path, 3), outlineInk)) < 0.01;

  // Shapes are added back to front, each with a gap cut around it, so a
  // shape in front never merges with the one behind it.
  let solid = ops.empty();
  for (const sub of fillables) sub.behind = isBehind(sub, subs);
  const ordered = [...fillables].sort(
    (a, b) => a.depth - b.depth || Number(b.behind) - Number(a.behind) || a.index - b.index,
  );
  for (const sub of ordered) {
    if (sub.depth % 2 === 0) {
      solid = ops.difference(solid, ops.stroke(sub.silhouette, 2 * gap));
      solid = ops.union(solid, sub.cut ? ops.difference(sub.silhouette, sub.cut) : sub.silhouette);
    } else {
      solid = ops.difference(solid, sub.silhouette);
    }
    outlineInk = ops.union(outlineInk, sub.ink);
  }

  // Lines are judged against the filled shapes before any line is cut out of
  // them, so crossing lines, such as a plus, are cut out together.
  const filled = solid;
  for (const sub of subs.filter((sub) => !sub.fillable)) {
    const inkArea = area(sub.ink);
    const inside = inkArea ? area(ops.intersect(sub.ink, filled)) / inkArea : 0;
    if (inside > 0.8) {
      solid = ops.difference(solid, ops.stroke(sub.path, cutWidth));
    } else if (inside >= 0.5 && inside * inkArea >= 8) {
      // Mostly inside: cut out where it crosses the fill, ink beyond it. A
      // short line that only pokes into a fill, like a calendar pin, stays ink.
      const outside = ops.difference(ops.stroke(sub.path, solidLineWidth), filled);
      solid = ops.union(ops.difference(solid, ops.stroke(sub.path, cutWidth)), outside);
    } else {
      const line = ops.stroke(sub.path, solidLineWidth);
      if (inside === 0 && apart(sub)) {
        solid = ops.difference(solid, ops.stroke(sub.path, solidLineWidth + 2 * gap));
      }
      solid = ops.union(solid, line);
    }
    outlineInk = ops.union(outlineInk, sub.ink);
  }
  return solid.simplify() ?? solid;
}

const round = (value) => {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? 0 : rounded;
};

// Path data with three decimals, as icons:optimize writes it.
export function toPathData(path) {
  const parts = [];
  const unscaled = path.copy().transform(1 / scale, 0, 0, 0, 1 / scale, 0, 0, 0, 1);
  for (const cmd of unscaled.toCmds()) {
    const [verb, ...args] = cmd;
    const values = (count) => args.slice(0, count).map(round).join(" ");
    if (verb === MOVE) parts.push(`M${values(2)}`);
    else if (verb === LINE) parts.push(`L${values(2)}`);
    else if (verb === QUAD) parts.push(`Q${values(4)}`);
    else if (verb === CUBIC) parts.push(`C${values(6)}`);
    else if (verb === CONIC) {
      // A conic is a rational quadratic; draw it as the cubic that matches
      // its ends, end tangents, and midpoint.
      const [x1, y1, x2, y2, w] = args;
      const previous = parts.lastPoint;
      const k = (4 * w) / (3 * (1 + w));
      parts.push(
        `C${[
          previous[0] + k * (x1 - previous[0]),
          previous[1] + k * (y1 - previous[1]),
          x2 + k * (x1 - x2),
          y2 + k * (y1 - y2),
          x2,
          y2,
        ]
          .map(round)
          .join(" ")}`,
      );
    } else if (verb === CLOSE) parts.push("Z");
    if (verb !== CLOSE) parts.lastPoint = verb === CONIC ? [args[2], args[3]] : args.slice(-2);
    if (verb === MOVE) parts.moveStart = args.slice(0, 2);
    if (verb === CLOSE) parts.lastPoint = parts.moveStart;
  }
  return parts.join("");
}

export function solidSvg(pathData) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd">\n<path d="${pathData}"/>\n</svg>\n`;
}

// Drafts every icon that has no solid yet, or the named ones with --force.
// Usage: bun run icons:draft-solid [--force] [name...]
async function main(args) {
  const { mkdir, readFile, readdir, writeFile } = await import("node:fs/promises");
  const { existsSync } = await import("node:fs");
  const path = await import("node:path");
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const force = args.includes("--force");
  const requested = args.filter((arg) => !arg.startsWith("--"));
  const iconsDir = path.join(root, "icons");
  const solidDir = path.join(root, "icons-solid");
  await mkdir(solidDir, { recursive: true });
  const hintsPath = path.join(root, "metadata/solid-hints.json");
  const hints = existsSync(hintsPath) ? JSON.parse(await readFile(hintsPath, "utf8")) : {};
  const hintsFor = (name) => ({
    ...hints.icons?.[name],
    mode: hints.line?.includes(name) ? "line" : hints.letters?.includes(name) ? "letters" : undefined,
  });
  const names = requested.length
    ? requested
    : (await readdir(iconsDir)).filter((file) => file.endsWith(".svg")).map((file) => file.slice(0, -4)).sort();
  const PK = await loadPathKit();
  const drafted = new Map();
  const draft = async (name) => {
    if (drafted.has(name)) return drafted.get(name);
    const svg = await readFile(path.join(iconsDir, `${name}.svg`), "utf8");
    const baseName = name.endsWith("-off") ? name.slice(0, -4) : null;
    const base = baseName && existsSync(path.join(iconsDir, `${baseName}.svg`)) ? await draft(baseName) : undefined;
    const solid = draftSolid(PK, pathDataOf(svg), { base, hints: hintsFor(name) });
    drafted.set(name, solid);
    return solid;
  };
  let written = 0;
  for (const name of names) {
    const target = path.join(solidDir, `${name}.svg`);
    if (!force && existsSync(target)) continue;
    await writeFile(target, solidSvg(toPathData(await draft(name))));
    written += 1;
  }
  console.log(`Drafted ${written} solid icon${written === 1 ? "" : "s"}; run bun run icons:optimize next.`);
}

if (process.argv[1] === new URL(import.meta.url).pathname) await main(process.argv.slice(2));
