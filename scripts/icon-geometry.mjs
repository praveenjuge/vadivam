// Geometry helpers for Vadivam's 24px icons.
//
// The path parser is a small, dependency-free implementation of the SVG path
// grammar (M L H V C S Q T A Z, absolute and relative). Every source icon is
// SVGO output made only of <path> elements, so a full SVG library would add a
// dependency for no extra coverage. Relative commands, shorthand curves, and
// H/V lines are normalized to absolute L, C, Q, and A segments.
//
// `bun scripts/icon-geometry.mjs` prints the measurements the design guide at
// /docs/design-guide is written from.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const argCounts = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
const numberPattern = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;

function tokenize(d) {
  const tokens = [];
  let i = 0;
  let command = null;
  let argIndex = 0;
  while (i < d.length) {
    const char = d[i];
    if (/[\s,]/.test(char)) {
      i += 1;
      continue;
    }
    if (/[MLHVCSQTAZ]/i.test(char)) {
      command = char;
      argIndex = 0;
      tokens.push(char);
      i += 1;
      continue;
    }
    if (!command) throw new Error(`Path data must start with a command: ${d}`);
    // Arc flags are single characters and may be written without separators.
    const isFlag = command.toUpperCase() === "A" && (argIndex % 7 === 3 || argIndex % 7 === 4);
    if (isFlag) {
      if (char !== "0" && char !== "1") throw new Error(`Invalid arc flag in: ${d}`);
      tokens.push(Number(char));
      i += 1;
    } else {
      const match = d.slice(i).match(numberPattern);
      if (!match) throw new Error(`Invalid path data near "${d.slice(i, i + 12)}"`);
      tokens.push(Number(match[0]));
      i += match[0].length;
    }
    argIndex += 1;
  }
  return tokens;
}

/**
 * Parse path data into subpaths of absolute segments.
 * Each segment is { type: "L" | "C" | "Q" | "A", from, to, ... } with points as [x, y].
 */
export function parsePath(d) {
  const tokens = tokenize(d);
  const subpaths = [];
  let current = null;
  let point = [0, 0];
  let start = [0, 0];
  let lastControl = null;
  let lastType = null;
  let i = 0;

  const ensureSubpath = () => {
    if (!current) {
      current = { start: [...point], closed: false, segments: [] };
      subpaths.push(current);
    }
  };

  while (i < tokens.length) {
    const raw = tokens[i];
    if (typeof raw !== "string") throw new Error(`Unexpected number in path data: ${d}`);
    i += 1;
    const type = raw.toUpperCase();
    const relative = raw !== type;
    const count = argCounts[type];

    if (type === "Z") {
      if (current) {
        if (Math.hypot(point[0] - start[0], point[1] - start[1]) > 1e-9) {
          current.segments.push({ type: "L", from: point, to: [...start], closing: true });
        }
        current.closed = true;
      }
      point = [...start];
      current = null;
      lastControl = null;
      lastType = "Z";
      continue;
    }

    let first = true;
    do {
      const args = tokens.slice(i, i + count);
      if (args.length < count || args.some((value) => typeof value !== "number")) {
        throw new Error(`Command ${raw} is missing arguments in: ${d}`);
      }
      i += count;
      const abs = (x, y) => (relative ? [point[0] + x, point[1] + y] : [x, y]);
      let segmentType = type;
      if (type === "M" && first) {
        point = abs(args[0], args[1]);
        start = [...point];
        current = { start: [...point], closed: false, segments: [] };
        subpaths.push(current);
        lastControl = null;
        lastType = "M";
        first = false;
        continue;
      }
      ensureSubpath();
      const from = point;
      if (type === "M" || type === "L") {
        segmentType = "L";
        point = abs(args[0], args[1]);
        current.segments.push({ type: "L", from, to: point });
        lastControl = null;
      } else if (type === "H") {
        point = [relative ? point[0] + args[0] : args[0], point[1]];
        current.segments.push({ type: "L", from, to: point });
        lastControl = null;
      } else if (type === "V") {
        point = [point[0], relative ? point[1] + args[0] : args[0]];
        current.segments.push({ type: "L", from, to: point });
        lastControl = null;
      } else if (type === "C" || type === "S") {
        let c1;
        let c2;
        let to;
        if (type === "C") {
          c1 = abs(args[0], args[1]);
          c2 = abs(args[2], args[3]);
          to = abs(args[4], args[5]);
        } else {
          c1 = lastType === "C" && lastControl
            ? [2 * from[0] - lastControl[0], 2 * from[1] - lastControl[1]]
            : [...from];
          c2 = abs(args[0], args[1]);
          to = abs(args[2], args[3]);
        }
        current.segments.push({ type: "C", from, c1, c2, to });
        point = to;
        lastControl = c2;
        segmentType = "C";
      } else if (type === "Q" || type === "T") {
        let c;
        let to;
        if (type === "Q") {
          c = abs(args[0], args[1]);
          to = abs(args[2], args[3]);
        } else {
          c = lastType === "Q" && lastControl
            ? [2 * from[0] - lastControl[0], 2 * from[1] - lastControl[1]]
            : [...from];
          to = abs(args[0], args[1]);
        }
        current.segments.push({ type: "Q", from, c, to });
        point = to;
        lastControl = c;
        segmentType = "Q";
      } else if (type === "A") {
        const to = abs(args[5], args[6]);
        current.segments.push({
          type: "A",
          from,
          rx: Math.abs(args[0]),
          ry: Math.abs(args[1]),
          rotation: args[2],
          largeArc: args[3] === 1,
          sweep: args[4] === 1,
          to,
        });
        point = to;
        lastControl = null;
      }
      lastType = segmentType;
      first = false;
    } while (i < tokens.length && typeof tokens[i] === "number");
  }
  return subpaths;
}

const format = (value) => {
  const rounded = Math.round(value * 1e4) / 1e4;
  return String(Object.is(rounded, -0) ? 0 : rounded);
};
const point = ([x, y]) => `${format(x)} ${format(y)}`;

/** Path data for subpaths in the form `parsePath` returns. */
export function serializePath(subpaths) {
  return subpaths
    .map((subpath) => {
      let d = `M${point(subpath.start)}`;
      for (const segment of subpath.segments) {
        if (segment.closing) continue;
        if (segment.type === "L") d += `L${point(segment.to)}`;
        else if (segment.type === "C") d += `C${point(segment.c1)} ${point(segment.c2)} ${point(segment.to)}`;
        else if (segment.type === "Q") d += `Q${point(segment.c)} ${point(segment.to)}`;
        else {
          const flags = `${segment.largeArc ? 1 : 0} ${segment.sweep ? 1 : 0}`;
          d += `A${format(segment.rx)} ${format(segment.ry)} ${format(segment.rotation)} ${flags} ${point(segment.to)}`;
        }
      }
      return subpath.closed ? `${d}Z` : d;
    })
    .join("");
}

// SVG arc endpoint parameterization to center parameterization (SVG 1.1 F.6.5).
export function arcCenter(segment) {
  const [x1, y1] = segment.from;
  const [x2, y2] = segment.to;
  let { rx, ry } = segment;
  const phi = (segment.rotation * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const numerator = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const denominator = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let factor = Math.sqrt(Math.max(0, numerator / denominator));
  if (segment.largeArc === segment.sweep) factor = -factor;
  const cxp = (factor * rx * y1p) / ry;
  const cyp = (-factor * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const angle = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!segment.sweep && delta > 0) delta -= 2 * Math.PI;
  if (segment.sweep && delta < 0) delta += 2 * Math.PI;
  return { cx, cy, rx, ry, cos, sin, theta1, delta };
}

export function segmentLength(segment) {
  return polylineLength(sampleSegment(segment, 24));
}

function polylineLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return total;
}

/** Points along a segment, including both endpoints. */
export function sampleSegment(segment, steps = 32) {
  const points = [];
  if (segment.type === "L") return [segment.from, segment.to];
  if (segment.type === "A") {
    if (segment.rx === 0 || segment.ry === 0) return [segment.from, segment.to];
    const { cx, cy, rx, ry, cos, sin, theta1, delta } = arcCenter(segment);
    for (let i = 0; i <= steps; i += 1) {
      const theta = theta1 + (delta * i) / steps;
      const x = rx * Math.cos(theta);
      const y = ry * Math.sin(theta);
      points.push([cx + cos * x - sin * y, cy + sin * x + cos * y]);
    }
    points[0] = segment.from;
    points[steps] = segment.to;
    return points;
  }
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const u = 1 - t;
    if (segment.type === "C") {
      const { from: p0, c1, c2, to: p3 } = segment;
      points.push([
        u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1],
      ]);
    } else {
      const { from: p0, c, to: p2 } = segment;
      points.push([
        u * u * p0[0] + 2 * u * t * c[0] + t * t * p2[0],
        u * u * p0[1] + 2 * u * t * c[1] + t * t * p2[1],
      ]);
    }
  }
  return points;
}

/** Points along a subpath spaced no more than `spacing` apart. */
export function sampleSubpath(subpath, spacing = 0.1) {
  const points = [subpath.start];
  for (const segment of subpath.segments) {
    const rough = sampleSegment(segment, 16);
    const steps = Math.max(1, Math.ceil(polylineLength(rough) / spacing));
    const sampled = segment.type === "L" ? lineSamples(segment, steps) : sampleSegment(segment, steps);
    points.push(...sampled.slice(1));
  }
  return points;
}

function lineSamples(segment, steps) {
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    points.push([
      segment.from[0] + (segment.to[0] - segment.from[0]) * t,
      segment.from[1] + (segment.to[1] - segment.from[1]) * t,
    ]);
  }
  return points;
}

/** Path data strings from a normalized Vadivam SVG. */
export function pathDataFromSvg(svg) {
  return [...svg.matchAll(/<path\b[^>]*\sd="([^"]*)"/g)].map((match) => match[1]);
}

export function bounds(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** Bounding box of the drawn ink: the centerline expanded by half the stroke width. */
export function strokeBounds(svg, strokeWidth = 2) {
  return inkBounds(pathDataFromSvg(svg).map((d) => ["path", { d }]), strokeWidth);
}

function numbers(value) {
  return String(value ?? "")
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
}

/**
 * Centerline points that bound one SVG shape element, given its tag and
 * geometry attributes (unprefixed names such as `d`, `cx`, or `points`).
 */
/** Path data for any allowed shape element, so stroke checks see every element alike. */
export function elementPathData(tag, attrs) {
  const value = (name) => Number(attrs[name] ?? 0);
  if (tag === "path") return String(attrs.d ?? "");
  if (tag === "line") return `M${value("x1")} ${value("y1")}L${value("x2")} ${value("y2")}`;
  if (tag === "polyline" || tag === "polygon") {
    const list = numbers(attrs.points);
    return `M${list.join(" ")}${tag === "polygon" ? "Z" : ""}`;
  }
  if (tag === "rect") return `M${value("x")} ${value("y")}h${value("width")}v${value("height")}h${-value("width")}Z`;
  if (tag === "circle" || tag === "ellipse") {
    const rx = tag === "circle" ? value("r") : value("rx");
    const ry = tag === "circle" ? value("r") : value("ry");
    const [cx, cy] = [value("cx"), value("cy")];
    return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
  }
  return "";
}

export function elementPoints(tag, attrs) {
  const value = (name) => Number(attrs[name] ?? 0);
  if (tag === "path") {
    return parsePath(String(attrs.d ?? "")).flatMap((subpath) => [
      subpath.start,
      ...subpath.segments.flatMap((segment) => sampleSegment(segment, 64)),
    ]);
  }
  if (tag === "circle" || tag === "ellipse") {
    const rx = tag === "circle" ? value("r") : value("rx");
    const ry = tag === "circle" ? value("r") : value("ry");
    return [
      [value("cx") - rx, value("cy") - ry],
      [value("cx") + rx, value("cy") + ry],
    ];
  }
  if (tag === "rect") {
    return [
      [value("x"), value("y")],
      [value("x") + value("width"), value("y") + value("height")],
    ];
  }
  if (tag === "line") {
    return [
      [value("x1"), value("y1")],
      [value("x2"), value("y2")],
    ];
  }
  if (tag === "polyline" || tag === "polygon") {
    const list = numbers(attrs.points);
    const points = [];
    for (let i = 0; i + 1 < list.length; i += 2) points.push([list[i], list[i + 1]]);
    return points;
  }
  return [];
}

/**
 * Bounding box of the ink for a list of [tag, attrs] shape elements. With round
 * caps and joins, the stroke reaches exactly half the stroke width past the
 * centerline in every direction.
 */
export function inkBounds(elements, strokeWidth = 2) {
  const points = elements.flatMap(([tag, attrs]) => elementPoints(tag, attrs));
  if (points.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) {
    throw new Error("geometry has non-numeric coordinates");
  }
  const box = bounds(points);
  const half = strokeWidth / 2;
  return { minX: box.minX - half, minY: box.minY - half, maxX: box.maxX + half, maxY: box.maxY + half };
}

/** Classify a coordinate as on the integer grid, on a half pixel, or elsewhere. */
export function gridClass(value, tolerance = 0.01) {
  const fraction = Math.abs(value - Math.round(value));
  if (fraction <= tolerance) return "integer";
  if (Math.abs(Math.abs(value - Math.floor(value)) - 0.5) <= tolerance) return "half";
  return "other";
}

const near = (a, b, tolerance) => Math.abs(a - b) <= tolerance;

/** Detect a closed subpath that is a circle; returns { cx, cy, r } or null. */
export function detectCircle(subpath, tolerance = 0.06) {
  if (!subpath.closed && !samePoint(subpath.start, lastPoint(subpath))) return null;
  if (subpath.segments.some((segment) => segment.type === "L" && segmentLength(segment) > 0.05)) return null;
  const points = subpath.segments.flatMap((segment) => sampleSegment(segment, 32));
  const box = bounds(points);
  const width = box.maxX - box.minX;
  const height = box.maxY - box.minY;
  if (width < 0.5 || !near(width, height, tolerance * 2)) return null;
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  const r = (width + height) / 4;
  for (const [x, y] of points) {
    if (!near(Math.hypot(x - cx, y - cy), r, tolerance)) return null;
  }
  return { cx, cy, r };
}

function lastPoint(subpath) {
  return subpath.segments.at(-1)?.to ?? subpath.start;
}

function samePoint(a, b, tolerance = 0.01) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) <= tolerance;
}

function roundedRectDistance(x, y, box, r) {
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  const hx = (box.maxX - box.minX) / 2 - r;
  const hy = (box.maxY - box.minY) / 2 - r;
  const qx = Math.abs(x - cx) - hx;
  const qy = Math.abs(y - cy) - hy;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - r;
}

/**
 * Detect a closed, axis-aligned rectangle with equal corner radii (a circle is
 * excluded). Returns { x, y, width, height, r } or null.
 */
export function detectRoundedRect(subpath, tolerance = 0.06) {
  if (!subpath.closed && !samePoint(subpath.start, lastPoint(subpath))) return null;
  const straight = subpath.segments.filter((segment) => segment.type === "L" && segmentLength(segment) > 0.05);
  if (straight.length > 4) return null;
  const points = subpath.segments.flatMap((segment) => sampleSegment(segment, 32));
  const box = bounds(points);
  const width = box.maxX - box.minX;
  const height = box.maxY - box.minY;
  if (width < 0.5 || height < 0.5) return null;
  // A smoothed corner can use a whole side, leaving no straight run on it.
  if (straight.length === 0) {
    const smoothed = smoothedRectCorners(subpath, box, [width / 2, height / 2], tolerance);
    return smoothed ? { x: box.minX, y: box.minY, width, height, ...smoothed } : null;
  }
  // Each straight side lies on the box edge; the gap to the corner is the radius.
  const radii = [];
  for (const { from, to } of straight) {
    if (near(from[1], to[1], 1e-3) && (near(from[1], box.minY, 1e-3) || near(from[1], box.maxY, 1e-3))) {
      radii.push(Math.min(from[0], to[0]) - box.minX, box.maxX - Math.max(from[0], to[0]));
    } else if (near(from[0], to[0], 1e-3) && (near(from[0], box.minX, 1e-3) || near(from[0], box.maxX, 1e-3))) {
      radii.push(Math.min(from[1], to[1]) - box.minY, box.maxY - Math.max(from[1], to[1]));
    } else {
      return null;
    }
  }
  const r = Math.min(...radii);
  if (r < -tolerance || r > Math.min(width, height) / 2 + tolerance) return null;
  const rect = { x: box.minX, y: box.minY, width, height };
  if (points.every(([x, y]) => Math.abs(roundedRectDistance(x, y, box, Math.max(0, r))) <= tolerance)) {
    return { ...rect, r: Math.max(0, r), smoothing: 0 };
  }
  const smoothed = smoothedRectCorners(subpath, box, radii, tolerance);
  return smoothed ? { ...rect, ...smoothed } : null;
}

/**
 * Corners of a rectangle drawn with smoothed corners (cubic, arc, cubic): four
 * equal arcs, each centered r in from its box corner, whose straight sides stop
 * (1 + smoothing) × r short of the corner. Returns { r, smoothing } or null.
 */
function smoothedRectCorners(subpath, box, gaps, tolerance) {
  const arcs = subpath.segments.filter((segment) => segment.type === "A");
  const cubics = subpath.segments.filter((segment) => segment.type === "C");
  if (arcs.length !== 4 || cubics.length !== 8) return null;
  const corners = arcs.map((arc) => {
    const { cx, cy, rx, ry, delta } = arcCenter(arc);
    return { cx, cy, r: (rx + ry) / 2, smoothing: 1 - Math.abs(delta) / (Math.PI / 2) };
  });
  const [{ r, smoothing }] = corners;
  if (smoothing <= 0 || smoothing >= 1) return null;
  for (const corner of corners) {
    if (!near(corner.r, r, 0.01) || !near(corner.smoothing, smoothing, 0.01)) return null;
    const insetX = Math.min(corner.cx - box.minX, box.maxX - corner.cx);
    const insetY = Math.min(corner.cy - box.minY, box.maxY - corner.cy);
    if (!near(insetX, r, tolerance) || !near(insetY, r, tolerance)) return null;
  }
  if (gaps.some((gap) => !near(gap, (1 + smoothing) * r, tolerance))) return null;
  const half = Math.min(box.maxX - box.minX, box.maxY - box.minY) / 2;
  if ((1 + smoothing) * r > half + tolerance) return null;
  return { r, smoothing: Math.round(smoothing * 100) / 100 };
}

/**
 * Stroke ends that stop 0.3–2px short of another stroke's centerline. With a
 * 2px stroke the two overlap without meeting and render as a blob. An end
 * already past the other centerline is an overhang drawn on purpose, and is
 * not counted. Returns [{ point, distance }].
 */
export function shortStrokeEnds(subpaths) {
  const samples = subpaths.map((subpath) => sampleSubpath(subpath, 0.05));
  const lengths = samples.map((points) => points.length * 0.05);
  const ends = [];
  subpaths.forEach((subpath, index) => {
    const last = subpath.segments.at(-1);
    if (!last || lengths[index] < 0.1 || subpath.closed || samePoint(subpath.start, last.to, 1e-3)) return;
    for (const atStart of [true, false]) {
      const point = atStart ? subpath.start : last.to;
      let nearest = null;
      let distance = Infinity;
      samples.forEach((points, other) => {
        if (lengths[other] < 0.1) return;
        points.forEach((sample, position) => {
          const d = Math.hypot(sample[0] - point[0], sample[1] - point[1]);
          // The stroke's own body counts only where it folds back toward this end.
          if (other === index) {
            const along = (atStart ? position : points.length - 1 - position) * 0.05;
            if (along <= Math.max(4, 3 * d)) return;
          }
          if (d < distance) {
            distance = d;
            nearest = sample;
          }
        });
      });
      if (!(distance >= 0.3 && distance < 2)) continue;
      const segment = atStart ? subpath.segments[0] : last;
      const along = sampleSegment(segment, 64);
      const inner = atStart ? along[1] : along.at(-2);
      const direction = [point[0] - inner[0], point[1] - inner[1]];
      if (direction[0] * (nearest[0] - point[0]) + direction[1] * (nearest[1] - point[1]) <= 0) continue;
      ends.push({ point, distance });
    }
  });
  return ends;
}

/** Shortest distance between two point samples, pruned by their bounding boxes. */
function minDistance(a, b, boxA, boxB, limit) {
  const gapX = Math.max(0, boxA.minX - boxB.maxX, boxB.minX - boxA.maxX);
  const gapY = Math.max(0, boxA.minY - boxB.maxY, boxB.minY - boxA.maxY);
  if (Math.hypot(gapX, gapY) > limit) return Infinity;
  let best = Infinity;
  for (const [ax, ay] of a) {
    for (const [bx, by] of b) {
      const dx = ax - bx;
      const dy = ay - by;
      const d = dx * dx + dy * dy;
      if (d < best) best = d;
    }
  }
  return Math.sqrt(best);
}

/**
 * Measure one icon. Gaps are centerline distances between separate subpaths
 * that do not touch; the visible gap is that distance minus the stroke width.
 */
export function analyzeIcon(svg, { gaps = false } = {}) {
  const pathData = pathDataFromSvg(svg);
  const subpaths = pathData.flatMap((d) => parsePath(d));
  const segments = subpaths.flatMap((subpath) => subpath.segments);
  const vertices = subpaths.flatMap((subpath) => [subpath.start, ...subpath.segments.map((segment) => segment.to)]);
  const straight = segments.filter((segment) => segment.type === "L" && segmentLength(segment) > 1e-6);
  const axisLines = straight.flatMap((segment) => {
    if (near(segment.from[1], segment.to[1], 1e-6)) return [{ orientation: "horizontal", offset: segment.from[1], segment }];
    if (near(segment.from[0], segment.to[0], 1e-6)) return [{ orientation: "vertical", offset: segment.from[0], segment }];
    return [];
  });
  const circles = subpaths.map((subpath) => detectCircle(subpath)).filter(Boolean);
  const rects = subpaths
    .filter((subpath) => !detectCircle(subpath))
    .map((subpath) => detectRoundedRect(subpath))
    .filter(Boolean);
  const arcs = segments.filter((segment) => segment.type === "A");
  const result = {
    paths: pathData.length,
    subpaths: subpaths.length,
    segments: segments.length,
    closedSubpaths: subpaths.filter((subpath) => subpath.closed).length,
    strokeBounds: strokeBounds(svg),
    vertices,
    straight,
    axisLines,
    circles,
    rects,
    arcs,
  };
  if (gaps) {
    const samples = subpaths.map((subpath) => {
      const points = sampleSubpath(subpath, 0.1);
      return { points, box: bounds(points) };
    });
    const pairs = [];
    for (let i = 0; i < samples.length; i += 1) {
      for (let j = i + 1; j < samples.length; j += 1) {
        const distance = minDistance(samples[i].points, samples[j].points, samples[i].box, samples[j].box, 6);
        if (distance !== Infinity) pairs.push(distance);
      }
    }
    result.pairDistances = pairs;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Report

function percentile(sorted, p) {
  if (sorted.length === 0) return NaN;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function share(count, total) {
  return `${count} / ${total} (${((count / total) * 100).toFixed(1)}%)`;
}

function frequencies(values, limit = 12, format = (value) => value) {
  const counts = new Map();
  for (const value of values) {
    const key = format(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

const round = (value, step = 0.5) => String(Math.round(value / step) * step);

async function inkCoverage(icons) {
  const { Resvg } = await import("@resvg/resvg-js");
  const size = 96;
  return icons.map(({ name, svg }) => {
    const image = new Resvg(svg.replace('stroke="currentColor"', 'stroke="#000"'), {
      fitTo: { mode: "width", value: size },
    }).render();
    let alpha = 0;
    // `pixels` copies the buffer on every access, so read it once.
    const { pixels } = image;
    for (let i = 3; i < pixels.length; i += 4) alpha += pixels[i];
    return { name, coverage: alpha / 255 / (size * size) };
  });
}

export async function report(iconsDir) {
  const files = (await readdir(iconsDir)).filter((file) => file.endsWith(".svg")).sort();
  const icons = await Promise.all(
    files.map(async (file) => ({ name: file.slice(0, -4), svg: await readFile(path.join(iconsDir, file), "utf8") })),
  );
  const results = icons.map((icon) => ({ ...icon, ...analyzeIcon(icon.svg, { gaps: true }) }));
  const total = results.length;
  const out = [];
  const line = (text = "") => out.push(text);

  line(`Icons: ${total}`);
  const elementTags = frequencies(icons.flatMap(({ svg }) => [...svg.matchAll(/<([a-z]+)\b/g)].map((m) => m[1]).filter((tag) => tag !== "svg")));
  line(`Elements: ${elementTags.map(([tag, count]) => `${tag} ${count}`).join(", ")}`);

  line("\n## Live area (stroke bounds = centerline ± 1)");
  // 0.02px absorbs curve-fitting noise from the Figma export (e.g. 0.999 instead of 1).
  const within = (box, lo, hi, tolerance = 0.02) =>
    box.minX >= lo - tolerance && box.minY >= lo - tolerance && box.maxX <= hi + tolerance && box.maxY <= hi + tolerance;
  line(`Ink extremes across the set: ${Math.min(...results.flatMap((r) => [r.strokeBounds.minX, r.strokeBounds.minY])).toFixed(3)} to ${Math.max(...results.flatMap((r) => [r.strokeBounds.maxX, r.strokeBounds.maxY])).toFixed(3)}`);
  for (const [lo, hi] of [[0, 24], [1, 23], [2, 22], [3, 21]]) {
    line(`Ink within ${lo}–${hi}: ${share(results.filter((r) => within(r.strokeBounds, lo, hi)).length, total)}`);
  }
  const outside = results.filter((r) => !within(r.strokeBounds, 1, 23));
  line(`Outside 1–23: ${outside.map((r) => `${r.name} [${["minX", "minY", "maxX", "maxY"].map((k) => r.strokeBounds[k].toFixed(2)).join(", ")}]`).join("; ") || "none"}`);
  const touchesEdge = results.filter((r) => {
    const b = r.strokeBounds;
    return [b.minX, b.minY].some((v) => near(v, 1, 0.05)) || [b.maxX, b.maxY].some((v) => near(v, 23, 0.05));
  });
  line(`Ink reaching the 1px padding line on at least one side: ${share(touchesEdge.length, total)}`);
  const widths = results.map((r) => Math.max(r.strokeBounds.maxX - r.strokeBounds.minX, r.strokeBounds.maxY - r.strokeBounds.minY)).sort((a, b) => a - b);
  line(`Largest ink dimension: p5 ${percentile(widths, 5).toFixed(2)}, median ${percentile(widths, 50).toFixed(2)}, p95 ${percentile(widths, 95).toFixed(2)}`);
  const centerX = results.map((r) => (r.strokeBounds.minX + r.strokeBounds.maxX) / 2 - 12);
  const centerY = results.map((r) => (r.strokeBounds.minY + r.strokeBounds.maxY) / 2 - 12);
  const centered = results.filter((_r, i) => Math.abs(centerX[i]) <= 0.5 && Math.abs(centerY[i]) <= 0.5).length;
  line(`Ink box center within 0.5px of (12, 12): ${share(centered, total)}`);

  line("\n## Pixel grid");
  const allVertices = results.flatMap((r) => r.vertices.flatMap(([x, y]) => [x, y]));
  const classes = (values) => {
    const counts = { integer: 0, half: 0, other: 0 };
    for (const value of values) counts[gridClass(value)] += 1;
    return `integer ${share(counts.integer, values.length)}, half ${share(counts.half, values.length)}, other ${share(counts.other, values.length)}`;
  };
  line(`All vertex coordinates: ${classes(allVertices)}`);
  const straightEnds = results.flatMap((r) => r.straight.flatMap(({ from, to }) => [...from, ...to]));
  line(`Straight segment endpoint coordinates: ${classes(straightEnds)}`);
  const axisOffsets = results.flatMap((r) => r.axisLines.map((l) => l.offset));
  line(`Horizontal/vertical segment offsets (the crisp-edge coordinate): ${classes(axisOffsets)}`);
  const longAxis = results.flatMap((r) => r.axisLines.filter((l) => segmentLength(l.segment) >= 2).map((l) => l.offset));
  line(`  …segments ≥ 2px long: ${classes(longAxis)}`);
  const iconsAllAxisInteger = results.filter((r) => r.axisLines.every((l) => gridClass(l.offset) === "integer"));
  line(`Icons whose every H/V segment sits on an integer offset: ${share(iconsAllAxisInteger.length, total)}`);
  const iconsAllStraightInteger = results.filter((r) => r.straight.every(({ from, to }) => [...from, ...to].every((v) => gridClass(v) === "integer")));
  line(`Icons whose every straight segment endpoint is on integers: ${share(iconsAllStraightInteger.length, total)}`);
  const diagonal = results.flatMap((r) => r.straight.filter((s) => !near(s.from[0], s.to[0], 1e-6) && !near(s.from[1], s.to[1], 1e-6)));
  const diagonal45 = diagonal.filter((s) => near(Math.abs(s.to[0] - s.from[0]), Math.abs(s.to[1] - s.from[1]), 0.01));
  line(`Straight segments: ${results.reduce((n, r) => n + r.straight.length, 0)}; axis-aligned ${axisOffsets.length}; diagonal ${diagonal.length} (45° ${share(diagonal45.length, diagonal.length)})`);
  const decimals = icons.flatMap(({ svg }) => pathDataFromSvg(svg).flatMap((d) => (d.match(/\.\d+/g) ?? []).map((m) => m.length - 1)));
  line(`Max decimal places in path data: ${Math.max(...decimals)}; distribution ${frequencies(decimals).map(([k, v]) => `${k}:${v}`).join(", ")}`);

  line("\n## Circles");
  const circles = results.flatMap((r) => r.circles.map((c) => ({ ...c, name: r.name })));
  line(`Full circles: ${circles.length} in ${results.filter((r) => r.circles.length).length} icons`);
  line(`Radius frequency: ${frequencies(circles.map((c) => c.r), 14, (v) => round(v, 0.25)).map(([k, v]) => `r${k}: ${v}`).join(", ")}`);
  line(`Circle centers on integer/half: ${classes(circles.flatMap((c) => [c.cx, c.cy]))}`);
  const largest = circles.filter((c) => c.r >= 9.75);
  line(`Circles with r ≥ 9.75: ${largest.length} (${frequencies(largest.map((c) => `${round(c.cx, 0.25)},${round(c.cy, 0.25)} r${round(c.r, 0.25)}`)).map(([k, v]) => `${k}×${v}`).join(", ")})`);

  line("\n## Rectangles");
  const rects = results.flatMap((r) => r.rects.map((rect) => ({ ...rect, name: r.name })));
  line(`Axis-aligned rectangles: ${rects.length} in ${results.filter((r) => r.rects.length).length} icons`);
  line(`Size frequency (w×h): ${frequencies(rects.map((r) => `${round(r.width)}×${round(r.height)}`), 16).map(([k, v]) => `${k}: ${v}`).join(", ")}`);
  line(`Corner radius frequency: ${frequencies(rects.map((r) => r.r), 12, (v) => round(v, 0.25)).map(([k, v]) => `r${k}: ${v}`).join(", ")}`);
  const big = rects.filter((r) => Math.min(r.width, r.height) >= 8);
  const small = rects.filter((r) => Math.min(r.width, r.height) < 8);
  line(`  shortest side ≥ 8: ${frequencies(big.map((r) => r.r), 8, (v) => round(v, 0.25)).map(([k, v]) => `r${k}: ${v}`).join(", ")} (n=${big.length})`);
  line(`  shortest side < 8: ${frequencies(small.map((r) => r.r), 8, (v) => round(v, 0.25)).map(([k, v]) => `r${k}: ${v}`).join(", ")} (n=${small.length})`);
  const ratio = rects.map((r) => r.r / Math.min(r.width, r.height));
  const sortedRatio = [...ratio].sort((a, b) => a - b);
  line(`Radius ÷ shortest side: p10 ${percentile(sortedRatio, 10).toFixed(2)}, median ${percentile(sortedRatio, 50).toFixed(2)}, p90 ${percentile(sortedRatio, 90).toFixed(2)}`);
  line(`Rect origins on integer/half: ${classes(rects.flatMap((r) => [r.x, r.y]))}`);
  line(`Sharp (r = 0) rectangles: ${rects.filter((r) => r.r < 0.05).length}`);
  for (const name of ["square", "rectangle-horizontal", "rectangle-vertical", "circle"]) {
    const r = results.find((item) => item.name === name);
    if (r) line(`${name}: ${JSON.stringify({ rects: r.rects.map(({ x, y, width, height, r: radius }) => ({ x, y, width, height, r: radius })), circles: r.circles })}`);
  }

  line("\n## Corner smoothing");
  const { cornerSmoothing, fullSmoothingEdge, measureCorners } = await import("./corner-smoothing.mjs");
  const corners = icons.flatMap(({ svg }) => pathDataFromSvg(svg).flatMap((d) => measureCorners(d)));
  const plain = corners.filter((c) => c.smoothing === 0);
  const full = corners.filter((c) => near(c.smoothing, cornerSmoothing, 0.01));
  const reduced = corners.filter((c) => c.smoothing > 0 && !near(c.smoothing, cornerSmoothing, 0.01)).map((c) => c.smoothing).sort((a, b) => a - b);
  line(`Rounded corners between straight lines: ${corners.length}; at ${cornerSmoothing * 100}% smoothing ${share(full.length, corners.length)}; plain circular arcs ${plain.length}`);
  line(`Less smoothing where there is no room (edges under ${fullSmoothingEdge}px, corners sharper than 90°): ${reduced.length}; p10 ${percentile(reduced, 10)?.toFixed(2)}, median ${percentile(reduced, 50)?.toFixed(2)}, p90 ${percentile(reduced, 90)?.toFixed(2)}`);
  line(`Rectangles at full smoothing: ${share(rects.filter((r) => near(r.smoothing, cornerSmoothing, 0.01)).length, rects.length)}`);
  line(`Corner turn frequency (nearest 15°): ${frequencies(corners.map((c) => (c.turn * 180) / Math.PI), 8, (v) => round(v, 15)).map(([k, v]) => `${k}°: ${v}`).join(", ")}`);

  line("\n## Arcs");
  const arcRadii = results.flatMap((r) => r.arcs.filter((a) => near(a.rx, a.ry, 1e-6)).map((a) => a.rx));
  line(`Circular arc commands: ${arcRadii.length}; radius frequency ${frequencies(arcRadii, 14, (v) => round(v, 0.5)).map(([k, v]) => `r${k}: ${v}`).join(", ")}`);
  const sortedArc = [...arcRadii].sort((a, b) => a - b);
  line(`Arc radius percentiles: p10 ${percentile(sortedArc, 10)}, median ${percentile(sortedArc, 50)}, p90 ${percentile(sortedArc, 90)}`);

  line("\n## Gaps between separate subpaths (visible gap = centerline distance − 2)");
  line("Subpaths closer than 0.3px are treated as joined. Gaps inside one subpath are not measured.");
  const touching = 0.3;
  const iconMinGaps = results
    .map((r) => {
      const separate = r.pairDistances.filter((d) => d > touching);
      return separate.length ? { name: r.name, gap: Math.min(...separate) - 2 } : null;
    })
    .filter(Boolean);
  const allGaps = results.flatMap((r) => r.pairDistances.filter((d) => d > touching).map((d) => d - 2));
  const bucket = (values) => {
    // Sampling is 0.1px apart, so each boundary allows 0.05px of slack.
    const b = { merged: 0, under1: 0, under15: 0, under2: 0, atLeast2: 0 };
    for (const g of values) {
      if (g < -0.05) b.merged += 1;
      else if (g < 0.95) b.under1 += 1;
      else if (g < 1.45) b.under15 += 1;
      else if (g < 1.95) b.under2 += 1;
      else b.atLeast2 += 1;
    }
    return `strokes overlap ${share(b.merged, values.length)}, 0–1px ${share(b.under1, values.length)}, 1–1.5px ${share(b.under15, values.length)}, 1.5–2px ${share(b.under2, values.length)}, ≥2px ${share(b.atLeast2, values.length)}`;
  };
  line(`Subpath pairs within 6px that do not touch: ${allGaps.length}: ${bucket(allGaps)}`);
  line(`Icons with separate subpaths: ${iconMinGaps.length}; per-icon smallest gap: ${bucket(iconMinGaps.map((g) => g.gap))}`);
  const sortedMin = iconMinGaps.map((g) => g.gap).sort((a, b) => a - b);
  line(`Per-icon smallest gap percentiles: p10 ${percentile(sortedMin, 10).toFixed(2)}, p25 ${percentile(sortedMin, 25).toFixed(2)}, median ${percentile(sortedMin, 50).toFixed(2)}`);
  line(`Gap frequency (nearest 0.25px): ${frequencies(allGaps, 12, (v) => round(v, 0.25)).map(([k, v]) => `${k}: ${v}`).join(", ")}`);
  line(`Smallest gaps: ${iconMinGaps.sort((a, b) => a.gap - b.gap).slice(0, 12).map((g) => `${g.name} ${g.gap.toFixed(2)}`).join(", ")}`);

  line("\n## Element counts");
  for (const key of ["paths", "subpaths", "closedSubpaths", "segments"]) {
    const values = results.map((r) => r[key]).sort((a, b) => a - b);
    line(`${key} per icon: min ${values[0]}, median ${percentile(values, 50)}, p90 ${percentile(values, 90)}, p99 ${percentile(values, 99)}, max ${values.at(-1)}`);
  }
  line(`Paths per icon: ${frequencies(results.map((r) => r.paths), 10).map(([k, v]) => `${k}: ${v}`).join(", ")}`);
  const maxClosed = results.flatMap((r) => pathDataFromSvg(r.svg).map((d) => (d.match(/z/gi) ?? []).length));
  line(`Most closed subpaths in one <path>: ${Math.max(...maxClosed)}`);
  const unclosedSingle = results.filter((r) => r.subpaths === 0);
  line(`Icons with no subpaths: ${unclosedSingle.length}`);
  const zeroLength = results.filter((r) => pathDataFromSvg(r.svg).flatMap((d) => parsePath(d)).some((s) => s.segments.length === 0));
  line(`Icons with a move-only subpath: ${zeroLength.length}${zeroLength.length ? ` (${zeroLength.slice(0, 10).map((r) => r.name).join(", ")})` : ""}`);

  line("\n## Visual weight (ink coverage of the 24×24 canvas, rendered at 96px)");
  const coverage = await inkCoverage(icons);
  const sortedCoverage = coverage.map((c) => c.coverage).sort((a, b) => a - b);
  const of = (name) => coverage.find((c) => c.name === name)?.coverage;
  line(`circle ${(of("circle") * 100).toFixed(1)}%, square ${(of("square") * 100).toFixed(1)}%`);
  line(`All icons: p5 ${(percentile(sortedCoverage, 5) * 100).toFixed(1)}%, p25 ${(percentile(sortedCoverage, 25) * 100).toFixed(1)}%, median ${(percentile(sortedCoverage, 50) * 100).toFixed(1)}%, p75 ${(percentile(sortedCoverage, 75) * 100).toFixed(1)}%, p95 ${(percentile(sortedCoverage, 95) * 100).toFixed(1)}%`);
  const heavy = coverage.filter((c) => c.coverage > of("square") * 1.25).length;
  line(`Heavier than 1.25× square: ${share(heavy, total)}`);
  line(`Heaviest: ${[...coverage].sort((a, b) => b.coverage - a.coverage).slice(0, 6).map((c) => `${c.name} ${(c.coverage * 100).toFixed(1)}%`).join(", ")}`);
  line(`Lightest: ${[...coverage].sort((a, b) => a.coverage - b.coverage).slice(0, 6).map((c) => `${c.name} ${(c.coverage * 100).toFixed(1)}%`).join(", ")}`);

  return out.join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  console.log(await report(path.join(root, "icons")));
}
