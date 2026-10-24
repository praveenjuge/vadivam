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
import { fileURLToPath } from "node:url";

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

// Whether a simplified path fills a point given in icon units.
function fills(path, [x, y]) {
  const point = [x * scale, y * scale];
  const contours = flatten(path.toCmds()).filter((contour) => contour.length > 2);
  return contours.filter((contour) => insidePolygon(point, contour)).length % 2 === 1;
}

// The separate pieces of a simplified path, each with its own holes.
function pieces(PK, path) {
  const contours = flatten(path.toCmds()).filter((contour) => contour.length > 2);
  const depths = contourDepths(contours);
  return contours
    .filter((_, index) => depths[index] % 2 === 0)
    .map((contour) => {
      const outline = new PK.SkPath();
      outline.moveTo(...contour[0]);
      for (const [x, y] of contour.slice(1)) outline.lineTo(x, y);
      outline.close();
      return PK.MakeFromOp(path, outline, PK.PathOp.INTERSECT);
    })
    .filter(Boolean);
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

function makeOps(PK) {
  const empty = () => new PK.SkPath();
  const op = (a, b, kind) => PK.MakeFromOp(a ?? empty(), b ?? empty(), kind) ?? empty();
  return {
    empty,
    union: (a, b) => op(a, b, PK.PathOp.UNION),
    difference: (a, b) => op(a, b, PK.PathOp.DIFFERENCE),
    intersect: (a, b) => op(a, b, PK.PathOp.INTERSECT),
    // Each contour is stroked on its own. Skia sometimes runs a closed
    // contour's inner edge the same way as its outer one, so winding fills
    // the whole inside; stroked closed and stroked open, at most one does,
    // and the smaller of the two is the true band.
    stroke: (path, width) => {
      const contours = [];
      for (const cmd of path.toCmds()) {
        if (cmd[0] === MOVE || !contours.length) contours.push([]);
        contours.at(-1).push(cmd);
      }
      const strokeOf = (cmds) => {
        const stroked = PK.FromCmds(cmds).stroke({
          width: width * scale,
          join: PK.StrokeJoin.ROUND,
          cap: PK.StrokeCap.ROUND,
        });
        if (!stroked) return null;
        stroked.setFillType(PK.FillType.WINDING);
        return stroked.simplify();
      };
      let result = empty();
      for (const cmds of contours) {
        let stroked = strokeOf(cmds);
        if (cmds.at(-1)[0] === CLOSE) {
          const open = strokeOf([...cmds.slice(0, -1), [LINE, cmds[0][1], cmds[0][2]]]);
          if (open && (!stroked || area(open) < area(stroked))) stroked = open;
        }
        if (stroked) result = op(result, stroked, PK.PathOp.UNION);
      }
      return result.simplify() ?? empty();
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
function isDome(sub, subs) {
  if (sub.closed || !hasCurve(sub) || sharpestTurn(sub) > 30 || endsOnClosedShape(sub, subs)) return false;
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

// Whether an open line meets a closed shape along the shape's own edge, like
// a P's stem running on from its bowl, rather than across it like a cog's
// tooth or a lock's shackle.
function continuesSide(sub, shape) {
  const edge = [...shape.line, shape.line[0]];
  return sub.line.some((point, index) => {
    const next = sub.line[index + 1] ?? sub.line[index - 1];
    const direction = minus(next, point);
    return edge.slice(1).some((end, i) => {
      if (distanceToLine(point, [edge[i], end]) >= 0.75) return false;
      const tangent = minus(end, edge[i]);
      const cos = (tangent[0] * direction[0] + tangent[1] * direction[1]) / (Math.hypot(...tangent) * Math.hypot(...direction) || 1);
      return Math.abs(cos) > 0.95;
    });
  });
}

function minus([x1, y1], [x2, y2]) {
  return [x1 - x2, y1 - y2];
}

// An open shape whose two ends run square to each other, like a card with a
// corner left open for a badge, closed at the corner they point to rather
// than straight across.
function closeAtCorner(sub) {
  const { line, path } = sub;
  const start = line[0];
  const end = line[line.length - 1];
  const unit = ([x, y]) => [x / (Math.hypot(x, y) || 1), y / (Math.hypot(x, y) || 1)];
  const out1 = unit(minus(start, line[1]));
  const out2 = unit(minus(end, line[line.length - 2]));
  // start + t1 * out1 = end + t2 * out2
  const det = out1[0] * -out2[1] + out2[0] * out1[1];
  if (Math.abs(det) < 1e-6) return path;
  const [dx, dy] = minus(end, start);
  const t1 = (dx * -out2[1] + out2[0] * dy) / det;
  const t2 = (out1[0] * dy - out1[1] * dx) / det;
  if (t1 <= 0 || t2 <= 0) return path;
  const closed = path.copy();
  closed.lineTo((start[0] + t1 * out1[0]) * scale, (start[1] + t1 * out1[1]) * scale);
  closed.close();
  return closed;
}

// Whether a subpath fits in a square of the given size.
function badgeBox(sub, size) {
  const xs = sub.line.map(([x]) => x);
  const ys = sub.line.map(([, y]) => y);
  return Math.max(...xs) - Math.min(...xs) <= size && Math.max(...ys) - Math.min(...ys) <= size;
}

// Points every half pixel along a polyline, so a straight line is measured
// along its length and not only at its two ends.
function samples(line) {
  const points = [line[0]];
  for (let i = 1; i < line.length; i += 1) {
    const [x1, y1] = line[i - 1];
    const [x2, y2] = line[i];
    const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 0.5));
    for (let step = 1; step <= steps; step += 1) points.push([x1 + ((x2 - x1) * step) / steps, y1 + ((y2 - y1) * step) / steps]);
  }
  return points;
}

// An open shape whose two ends stop on another shape's line is drawn behind
// that shape, like the back page of copy.
function isBehind(sub, subs) {
  if (sub.closed) return false;
  const ends = [sub.line[0], sub.line[sub.line.length - 1]];
  return subs.some((other) => other !== sub && ends.every((end) => distanceToLine(end, other.line) < 0.75));
}

// An open curve that stands on closed shapes, like a lock's shackle on its
// body or a headband on its ear cups, is a line of its own, not a dome.
function endsOnClosedShape(sub, subs) {
  const ends = [sub.line[0], sub.line[sub.line.length - 1]];
  return ends.every((end) => subs.some((other) => other !== sub && other.closed && distanceToLine(end, other.line) < 1));
}

// An open stroke whose ends stand on the two far sides of one closed shape,
// like a window's title bar on its body or a cylinder's wall under its lid,
// encloses a shape of its own. A lock's shackle, narrower than its body, stays
// a line.
function capsShape(sub, subs) {
  if (sub.closed) return false;
  const start = sub.line[0];
  const end = sub.line[sub.line.length - 1];
  const chord = Math.hypot(end[0] - start[0], end[1] - start[1]);
  if (chord < 4) return false;
  const direction = [(end[0] - start[0]) / chord, (end[1] - start[1]) / chord];
  return subs.some((other) => {
    if (other === sub || !other.closed) return false;
    if (distanceToLine(start, other.line) >= 1 || distanceToLine(end, other.line) >= 1) return false;
    const spans = other.line.map(([x, y]) => x * direction[0] + y * direction[1]);
    if (chord < 0.85 * (Math.max(...spans) - Math.min(...spans))) return false;
    // It stands outside the shape; a divider runs across inside it.
    const points = samples(sub.line);
    return points.filter((point) => insidePolygon(point, other.line)).length < 0.3 * points.length;
  });
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
// With `largest`, only the biggest hole is filled, so a lock drawn in one
// stroke keeps the opening under its shackle.
function fillHoles(PK, path, { largest = false } = {}) {
  if (largest) {
    const holes = [];
    for (const cmd of path.toCmds()) {
      if (cmd[0] === MOVE) holes.push([cmd]);
      else holes.at(-1)?.push(cmd);
    }
    const polygons = holes.map((cmds) => flatten(cmds)[0] ?? []);
    const depths = contourDepths(polygons);
    const inner = holes
      .map((cmds, index) => ({ cmds, depth: depths[index], size: Math.abs(polygonArea(polygons[index])) }))
      .filter(({ depth }) => depth === 1)
      .sort((a, b) => b.size - a.size)[0];
    if (!inner) return path;
    const hole = PK.FromCmds(inner.cmds);
    hole.setFillType(PK.FillType.WINDING);
    return PK.MakeFromOp(path, hole.simplify() ?? hole, PK.PathOp.UNION) ?? path;
  }
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
// `fill` and `line` force single subpaths by index, `drop` leaves detail out,
// such as a cog's spokes, and `largestHole` fills only the biggest area a
// stroke encloses.
export function draftSolid(PK, pathData, { base, hints = {} } = {}) {
  const ops = makeOps(PK);
  const dropped = new Set(hints.drop ?? []);
  const subs = subpaths(PK, pathData).filter((sub) => !dropped.has(sub.index));
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
    // An open stroke that loops back on itself, like a branch line ending in
    // a ring, fills its loop rather than reading as a gapped circle or dome.
    const loops =
      !sub.closed && !fillIndexes.has(sub.index) && area(fillHoles(PK, sub.ink)) - area(sub.ink) > 2;
    const gappedCircle =
      !loops && subs.length > 1 && !hints.largestHole && turning(sub) >= 240 && hasFreeEnds(sub, subs);
    if (gappedCircle && !sub.closed) sub.gap = [sub.line[0], sub.line[sub.line.length - 1]];
    if (
      sub.closed ||
      (!loops && (isDome(sub, subs) || capsShape(sub, subs))) ||
      fillIndexes.has(sub.index) ||
      gappedCircle
    ) {
      sub.fillable = true;
      sub.region = ops.fill(hints.closeCorner?.includes(sub.index) ? closeAtCorner(sub) : sub.path);
      sub.silhouette = ops.union(sub.region, sub.ink);
      // An open shape is closed across its gap, where a badge can sit.
      if (!sub.closed) sub.gap ??= [sub.line[0], sub.line[sub.line.length - 1]];
    } else {
      // An open stroke that loops back on itself, such as a bell drawn in one
      // line, fills the area it encloses. Its strokes that run inside that
      // area, such as an envelope's flap, are cut out like any inner line.
      const enclosed = fillHoles(PK, sub.ink, { largest: hints.largestHole });
      if (area(enclosed) - area(sub.ink) > 2) {
        sub.fillable = true;
        sub.region = enclosed;
        sub.silhouette = enclosed;
        // The outer stroke keeps 1px from the edge; a run of the stroke deeper
        // in is an inner line, cut out and run on through the edge it meets,
        // like a bottle's label line. Crumbs where the stroke turns sharply
        // inward, like the notches between a leaf's lobes, are too short.
        const core = ops.difference(enclosed, ops.stroke(enclosed, 3.2));
        const runs = [];
        let run = [];
        for (const point of samples(sub.line)) {
          if (fills(core, point)) run.push(point);
          else if (run.length) runs.push(run), (run = []);
        }
        if (run.length) runs.push(run);
        let inner = ops.empty();
        for (const points of runs.filter((points) => polylineLength(points) >= 1.5)) {
          const reach = (end, next) => {
            const [dx, dy] = minus(end, next);
            const length = Math.hypot(dx, dy) || 1;
            const tip = [end[0] + (2.5 * dx) / length, end[1] + (2.5 * dy) / length];
            // Not on into the fill, like a stem into its leaf; out through
            // the edge or along it, like a bell's rim past its clapper.
            return fills(core, tip) ? [] : [tip];
          };
          const line = [...reach(points[0], points[1]), ...points, ...reach(points.at(-1), points.at(-2))];
          const path = new PK.SkPath();
          path.moveTo(line[0][0] * scale, line[0][1] * scale);
          for (const [x, y] of line.slice(1)) path.lineTo(x * scale, y * scale);
          inner = ops.union(inner, ops.intersect(ops.stroke(path, cutWidth), enclosed));
        }
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

  // A small closed shape with the lines it carries, like a lock's body and
  // shackle or a clock's face and hands, is drafted on its own as a group.
  // In another shape's gap it is drawn in front with a gap, like a badge; inside
  // a shape it is knocked out of it.
  const touches = (sub, members) =>
    samples(sub.line).some((point) => members.some((member) => distanceToLine(point, member.line) < 0.75));
  const groups = [];
  const grouped = new Set();
  if (hints.front) {
    const members = subs.filter((sub) => hints.front.includes(sub.index));
    for (const member of members) grouped.add(member);
    groups.push({ front: true, members });
  }
  if (hints.mode !== "line" && hints.mode !== "letters") {
    for (const seed of fillables) {
      if (grouped.has(seed)) continue;
      const container =
        seed.depth % 2 === 1
          ? fillables.find(
              (other) =>
                other.depth === seed.depth - 1 &&
                other.area > seed.area &&
                area(ops.difference(seed.silhouette, other.region)) < 0.05 * seed.area,
            )
          : null;
      const body =
        seed.depth === 0 && badgeBox(seed, 11)
          ? fillables.find(
              (other) =>
                other !== seed &&
                other.gap &&
                other.area > seed.area &&
                samples(seed.line).some((point) => distanceToLine(point, other.gap) < 3) &&
                area(ops.difference(seed.silhouette, other.silhouette)) >= 0.1 * seed.area,
            )
          : null;
      if (!container && !body) continue;
      const members = [seed];
      const fits = (sub) =>
        container
          ? area(ops.intersect(sub.ink, container.region)) >= 0.8 * area(sub.ink)
          : samples(sub.line).every((point) => distanceToLine(point, body.line) >= 1.75);
      for (let grown = true; grown; ) {
        grown = false;
        for (const sub of subs) {
          if (sub.fillable || grouped.has(sub) || members.includes(sub) || !fits(sub) || !touches(sub, members)) continue;
          members.push(sub);
          grown = true;
        }
      }
      let front = Boolean(body);
      if (container) {
        // A shape inside another with no lines of its own is already a hole,
        // and a figure as large as a person keeps its lines.
        // One that reaches out through the shape's gap, like a gauge's needle
        // or a play button at a page's foot, is drawn in front of it instead.
        front =
          Boolean(container.gap) &&
          members.some((member) => samples(member.line).some((point) => distanceToLine(point, container.gap) < 1.5));
        if (!badgeBox({ line: members.flatMap((member) => member.line) }, 11)) continue;
        if (members.length === 1 && !front) continue;
        // A stroke that runs on from the shape's side, like a P's stem from
        // its bowl, makes a letter, which keeps its counter.
        if (members.some((member) => member !== seed && continuesSide(member, seed))) continue;
      }
      for (const member of members) grouped.add(member);
      groups.push({ front, members });
    }
  }
  fillables = fillables.filter((sub) => !grouped.has(sub));

  // Outline ink drawn so far, to tell which lines stood apart.
  let outlineInk = ops.empty();
  const apart = (sub) => area(ops.intersect(ops.stroke(sub.path, 3), outlineInk)) < 0.01;

  // Shapes are added back to front, each with a gap cut around it, so a
  // shape in front never merges with the one behind it.
  let solid = ops.empty();
  for (const sub of fillables) sub.behind = isBehind(sub, subs) || Boolean(hints.behind?.includes(sub.index));
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

  // Lines that sit in the gap of a shape drawn with one, such as the check
  // badge on a file's corner, are drawn in front of it with a gap, together.
  // A line that only closes the gap, like a chess piece's base, stays a line.
  const closesGap = (sub, chord) => isStraight(sub) && sub.line.every((point) => distanceToLine(point, chord) < 1.5);
  // A badge is small: a check, plus, or arrow, not a cog's teeth or a key's stem.
  const badgeSized = (sub) => sub.length >= 2 && badgeBox(sub, 9);
  const badges = subs.filter(
    (sub) =>
      !sub.fillable &&
      !grouped.has(sub) &&
      badgeSized(sub) &&
      fillables.some(
        (body) =>
          body.gap &&
          !closesGap(sub, body.gap) &&
          samples(sub.line).some((point) => distanceToLine(point, body.gap) < 3) &&
          samples(sub.line).every((point) => distanceToLine(point, body.line) >= 1.75) &&
          // A lone straight line mostly inside, like a power symbol's stem, is cut.
          area(ops.difference(sub.ink, body.silhouette)) >= (isStraight(sub) ? 0.5 : 0.25) * area(sub.ink),
      ),
  );
  // A badge drawn in several strokes, such as an arrow's shaft and head, moves
  // in front as one.
  for (let grown = true; grown; ) {
    grown = false;
    for (const sub of subs) {
      if (sub.fillable || grouped.has(sub) || badges.includes(sub)) continue;
      if (badges.some((badge) => samples(sub.line).some((point) => distanceToLine(point, badge.line) < 0.75))) {
        badges.push(sub);
        grown = true;
      }
    }
  }
  // Lines are judged against the filled shapes before any line is cut out of
  // them, so crossing lines, such as a plus, are cut out together.
  const filled = solid;
  // The fill without its outer 1.25px: a line whose centerline never enters
  // it runs along a shape's edge instead of crossing it.
  const core = ops.difference(filled, ops.stroke(filled, 2.5));
  const alongEdge = (sub) => samples(sub.line).every((point) => !fills(core, point));
  const clear = ops.union(filled, ops.stroke(filled, 2 * gap));
  const gaps = fillables.filter((sub) => sub.gap).map((sub) => sub.gap);
  const foldWindow = (sub) => {
    const ends = [sub.line[0], sub.line[sub.line.length - 1]];
    const body = fillables.find(
      (other) => other.closed && other.depth === 0 && ends.every((end) => distanceToLine(end, other.line) < 0.75),
    );
    if (!body) return null;
    const corner = pieces(PK, ops.difference(body.region, ops.stroke(sub.path, cutWidth))).find(
      (piece) => area(piece) < 0.1 * body.area,
    );
    if (!corner) return null;
    // The window reaches the fold's centerline and keeps the shape's edge.
    const reach = ops.intersect(ops.union(corner, ops.stroke(corner, cutWidth)), body.region);
    const window = ops.difference(reach, ops.stroke(body.path, solidLineWidth));
    return area(window) >= 3 ? window : null;
  };
  // A line cut out of a fill runs on through any edge it ends on, so the
  // pieces it divides, like a calendar's header and body, stand apart.
  const cutOf = (sub) => {
    let cut = ops.stroke(sub.path, cutWidth);
    if (sub.closed) return cut;
    const ends = [
      [sub.line[0], sub.line[1]],
      [sub.line[sub.line.length - 1], sub.line[sub.line.length - 2]],
    ];
    for (const [end, previous] of ends) {
      if (!previous) continue;
      const [dx, dy] = minus(end, previous);
      const length = Math.hypot(dx, dy) || 1;
      const tip = [end[0] + (2.5 * dx) / length, end[1] + (2.5 * dy) / length];
      for (const shape of fillables) {
        if (distanceToLine(end, shape.line) >= 0.75) continue;
        // On along the line out through the edge, or along it like the band
        // round a cylinder, but never on into the shape's body.
        shape.core ??= ops.difference(shape.silhouette, ops.stroke(shape.silhouette, 3.2));
        if (fills(shape.core, tip)) continue;
        const reach = new PK.SkPath();
        reach.moveTo(end[0] * scale, end[1] * scale);
        reach.lineTo(tip[0] * scale, tip[1] * scale);
        cut = ops.union(cut, ops.intersect(ops.stroke(reach, cutWidth), shape.silhouette));
      }
    }
    return cut;
  };
  let foldCut;
  for (const sub of subs.filter((sub) => !sub.fillable && !grouped.has(sub) && !badges.includes(sub))) {
    const inkArea = area(sub.ink);
    const inside = inkArea ? area(ops.intersect(sub.ink, filled)) / inkArea : 0;
    const inGap = gaps.some((chord) => samples(sub.line).some((point) => distanceToLine(point, chord) < 1.5));
    const outsideClear = inGap ? ops.difference(ops.stroke(sub.path, solidLineWidth), clear) : null;
    if (inside > 0 && alongEdge(sub)) {
      // A line along a shape's edge, such as the bar the align icons' shapes
      // stand on, joins the fill.
      solid = ops.union(solid, ops.stroke(sub.path, solidLineWidth));
    } else if (inside > 0.8 && (foldCut = foldWindow(sub))) {
      // A fold that cuts a small corner off a shape, like a page's dog-ear,
      // leaves the page whole with the corner as a window inside its edge.
      solid = ops.difference(solid, foldCut);
    } else if (inGap && inside > 0 && area(outsideClear) >= 1) {
      // A line that leaves a shape through its gap, such as rain under a
      // cloud or a check out of a box, is cut out inside and drawn 2px clear
      // outside.
      solid = ops.union(ops.difference(solid, cutOf(sub)), outsideClear);
    } else if (inside > 0.8) {
      solid = ops.difference(solid, cutOf(sub));
    } else if (inside >= 0.5 && inside * inkArea >= 8) {
      // Mostly inside: cut out where it crosses the fill, ink beyond it. A
      // short line that only pokes into a fill, like a calendar pin, stays ink.
      // Ink that would only bridge the gap between two fills, like a title
      // bar's ticks crossing into a window's body, is left out.
      const outside = pieces(PK, ops.difference(ops.stroke(sub.path, solidLineWidth), filled))
        .filter((piece) => area(ops.difference(piece, clear)) > 0.05)
        .reduce((all, piece) => ops.union(all, piece), ops.empty());
      solid = ops.union(ops.difference(solid, cutOf(sub)), outside);
    } else {
      let line = ops.stroke(sub.path, solidLineWidth);
      // A line that stood apart keeps a gap from the filled shapes, which stay
      // whole in front of it.
      if (inside === 0 && apart(sub)) line = ops.difference(line, ops.union(filled, ops.stroke(filled, 2 * gap)));
      solid = ops.union(solid, line);
    }
    outlineInk = ops.union(outlineInk, sub.ink);
  }
  for (const group of groups) {
    // Its lines stay lines, even an arc that alone would read as a dome.
    const line = group.members.flatMap((sub, index) => (sub.fillable ? [] : [index]));
    const drafted = draftSolid(
      PK,
      group.members.map((sub) => PK.FromCmds(sub.cmds).toSVGString()),
      { hints: { line, largestHole: hints.largestHole } },
    );
    solid = group.front
      ? ops.union(ops.difference(solid, ops.stroke(drafted, 2 * gap)), drafted)
      : ops.difference(solid, drafted);
  }
  if (badges.length) {
    const badge = badges.reduce((ink, sub) => ops.union(ink, ops.stroke(sub.path, solidLineWidth)), ops.empty());
    solid = ops.union(ops.difference(solid, ops.stroke(badge, 2 * gap)), badge);
  }
  // Specks left where cuts and gaps nearly meet, too small to read as shapes.
  for (const speck of pieces(PK, solid).filter((piece) => area(piece) < 0.4)) solid = ops.difference(solid, speck);
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

// Path data for each filled element of an SVG, in document order.
function elementPathData(svg) {
  const shapes = [];
  for (const [, tag, attrs] of svg.matchAll(/<(path|circle|ellipse|rect|polygon|polyline)\b([^>]*)>/g)) {
    const attr = (name) => attrs.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
    const number = (name) => Number(attr(name) ?? 0);
    if (tag === "path") shapes.push(attr("d") ?? "");
    else if (tag === "circle" || tag === "ellipse") {
      const [cx, cy] = [number("cx"), number("cy")];
      const [rx, ry] = tag === "circle" ? [number("r"), number("r")] : [number("rx"), number("ry")];
      shapes.push(`M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0z`);
    } else if (tag === "rect") {
      shapes.push(`M${number("x")} ${number("y")}h${number("width")}v${number("height")}h${-number("width")}z`);
    } else shapes.push(`M${(attr("points") ?? "").trim()}z`);
  }
  return shapes;
}

// The filled area of a solid SVG, as drafts are built. Each element fills by
// the root's even-odd rule on its own, and elements add up, so two that
// overlap stay ink instead of cutting a hole in each other.
export function solidPath(PK, svg) {
  let filled = null;
  for (const d of elementPathData(svg)) {
    const path = PK.FromSVGString(d).transform(scale, 0, 0, 0, scale, 0, 0, 0, 1);
    path.setFillType(PK.FillType.EVENODD);
    const shape = path.simplify() ?? path;
    filled = filled ? (PK.MakeFromOp(filled, shape, PK.PathOp.UNION) ?? filled) : shape;
  }
  return filled ?? new PK.SkPath();
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
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const force = args.includes("--force");
  const requested = args.filter((arg) => !arg.startsWith("--"));
  const iconsDir = path.join(root, "icons");
  const solidDir = path.join(root, "icons-solid");
  await mkdir(solidDir, { recursive: true });
  const hintsPath = path.join(root, "metadata/solid-hints.json");
  const hints = existsSync(hintsPath) ? JSON.parse(await readFile(hintsPath, "utf8")) : {};
  const hintsFor = (name) => ({
    ...hints.icons?.[name],
    mode: hints.line?.includes(name) ? "line" : hints.letters?.includes(name) ? "letters" : hints.icons?.[name]?.mode,
  });
  const names = requested.length
    ? requested
    : (await readdir(iconsDir)).filter((file) => file.endsWith(".svg")).map((file) => file.slice(0, -4)).sort();
  const PK = await loadPathKit();
  const saved = new Set(await readdir(solidDir));
  // Icons listed under manual were drawn by hand; only a missing file is drafted.
  const manual = new Set(hints.manual ?? []);
  const redrafted = (name) =>
    !saved.has(`${name}.svg`) || (force && !manual.has(name) && (!requested.length || requested.includes(name)));
  const drafted = new Map();
  const draft = async (name) => {
    if (drafted.has(name)) return drafted.get(name);
    const svg = await readFile(path.join(iconsDir, `${name}.svg`), "utf8");
    const baseName = name.endsWith("-off") ? name.slice(0, -4) : null;
    // An "-off" icon starts from its base's saved solid, so refinements made
    // in Figma carry over, unless the base is being drafted in this run too.
    let base;
    if (baseName && !redrafted(baseName)) {
      base = solidPath(PK, await readFile(path.join(solidDir, `${baseName}.svg`), "utf8"));
    } else if (baseName && existsSync(path.join(iconsDir, `${baseName}.svg`))) {
      base = await draft(baseName);
    }
    const solid = draftSolid(PK, pathDataOf(svg), { base, hints: hintsFor(name) });
    drafted.set(name, solid);
    return solid;
  };
  let written = 0;
  for (const name of names) {
    if (!redrafted(name)) continue;
    const target = path.join(solidDir, `${name}.svg`);
    await writeFile(target, solidSvg(toPathData(await draft(name))));
    written += 1;
  }
  console.log(`Drafted ${written} solid icon${written === 1 ? "" : "s"}; run bun run icons:optimize next.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
