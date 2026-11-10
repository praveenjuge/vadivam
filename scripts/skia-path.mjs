// Skia path ops for icon geometry: loading PathKit, measuring filled areas,
// and writing path data the way icons:optimize does. Shared by the optimizer
// (even-odd conversion of filled exports) and the solid drafter.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);


// Skia's stroker and path ops work to a fixed absolute tolerance, which is
// coarse on a 24px canvas, so every path is worked on at this scale.
export const scale = 64;

let pathKit;
export async function loadPathKit() {
  if (pathKit) return pathKit;
  const init = require("pathkit-wasm/bin/pathkit.js");
  const wasmBinary = readFileSync(require.resolve("pathkit-wasm/bin/pathkit.wasm"));
  pathKit = await init({ wasmBinary });
  return pathKit;
}

export const MOVE = 0;
export const LINE = 1;
export const QUAD = 2;
export const CONIC = 3;
export const CUBIC = 4;
export const CLOSE = 5;

function point(cmd) {
  return [cmd[cmd.length - (cmd[0] === CONIC ? 3 : 2)], cmd[cmd.length - (cmd[0] === CONIC ? 2 : 1)]];
}

// Samples every contour of a command list into polylines.
export function flatten(cmds, steps = 12) {
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

export function polygonArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

export function insidePolygon([x, y], points) {
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
export function contourDepths(contours) {
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


// Path data that fills under the evenodd rule what `d` fills under nonzero, or
// null when the two rules already fill the same area.
export function evenOddPathData(PK, d) {
  const nonzero = PK.FromSVGString(d).transform(scale, 0, 0, 0, scale, 0, 0, 0, 1);
  nonzero.setFillType(PK.FillType.WINDING);
  const evenOdd = nonzero.copy();
  evenOdd.setFillType(PK.FillType.EVENODD);
  if (area(PK.MakeFromOp(nonzero, evenOdd, PK.PathOp.XOR)) < 0.01) return null;
  return toPathData(nonzero.simplify());
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

