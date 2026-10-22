// Figma-style corner smoothing for Vadivam's centerline paths.
//
// A rounded corner is a circular arc that meets a straight line tangentially at
// both ends. Smoothing replaces it with Figma's smoothed corner, the curve its
// "iOS" preset draws at 60%: a cubic that eases off the line, a shorter arc of
// the same radius, and a mirrored cubic back onto the next line. The maths
// follows Figma's published construction for 90° corners
// (https://www.figma.com/blog/desperately-seeking-squircles/), written in a
// corner-local frame so the same curve also fits corners of other angles.
//
// A smoothed corner reaches (1 + smoothing) × the arc's tangent length along
// each line, so it needs more straight edge than a plain arc. Where an edge is
// too short, edges of at least `fullSmoothingEdge` keep the full smoothing by
// tightening the radius; shorter edges keep their radius and get as much
// smoothing as fits, as Figma does. Corners sharper than 90° always keep their
// radius, since a tighter radius would push their tip outward.

import { arcCenter, parsePath, sampleSubpath } from "./icon-geometry.mjs";

export const cornerSmoothing = 0.6;
export const fullSmoothingEdge = 8;
const radiusStep = 0.25;
// Figma exports round coordinates to 3 decimals, so tangency is checked loosely.
const tolerance = 0.02;
// Arcs that turn less than this are gentle bends rather than corners; the set
// has five such bends, all under 23°, and its sharpest corners start at 34°.
const minTurn = (30 * Math.PI) / 180;
const maxTurn = (170 * Math.PI) / 180;

const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const scale = (a, k) => [a[0] * k, a[1] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const length = (a) => Math.hypot(a[0], a[1]);
const unit = (a) => scale(a, 1 / length(a));
const distance = (a, b) => length(sub(a, b));

function isCyclic(subpath) {
  const end = subpath.segments.at(-1)?.to ?? subpath.start;
  return subpath.segments.length > 1 && (subpath.closed || distance(subpath.start, end) <= 1e-3);
}

function neighbor(segments, index, offset, cyclic) {
  const target = index + offset;
  if (target >= 0 && target < segments.length) return target;
  return cyclic ? (target + segments.length) % segments.length : -1;
}

function continuesLine(a, b) {
  if (a.type !== "L" || b.type !== "L") return false;
  const first = sub(a.to, a.from);
  const second = sub(b.to, b.from);
  if (length(first) <= 1e-6 || length(second) <= 1e-6) return false;
  return dot(unit(first), unit(second)) > 1 - 1e-6;
}

/**
 * Parse path data into subpaths whose straight edges are single segments.
 * Exports often split an edge, for example where a closed shape starts
 * partway along it, and each corner must see the whole edge.
 */
function edgeSubpaths(d) {
  return parsePath(d).map((subpath) => {
    const segments = [];
    for (const segment of subpath.segments) {
      const last = segments.at(-1);
      if (last && continuesLine(last, segment)) segments[segments.length - 1] = { ...last, to: segment.to, closing: segment.closing };
      else segments.push(segment);
    }
    // Move the start of a cyclic subpath off a split edge.
    if (segments.length > 2 && isCyclic({ ...subpath, segments }) && continuesLine(segments.at(-1), segments[0])) {
      const last = segments.pop();
      segments[0] = { ...segments[0], from: last.from };
      return { ...subpath, start: last.from, segments };
    }
    return { ...subpath, segments };
  });
}

// The unit normal of `direction` that points from `point` toward `center`.
function inwardNormal(direction, point, center) {
  const normal = [-direction[1], direction[0]];
  return dot(normal, sub(center, point)) >= 0 ? normal : scale(normal, -1);
}

/**
 * A plain rounded corner at `index`: a circular arc between two straight lines
 * that it meets tangentially. Returns the corner's vertex (where the two lines
 * would meet), its turn, radius, and edge directions, or null.
 */
function roundedCorner(segments, index, cyclic) {
  const arc = segments[index];
  if (arc.type !== "A" || arc.largeArc || arc.rx === 0 || arc.ry === 0) return null;
  const before = neighbor(segments, index, -1, cyclic);
  const after = neighbor(segments, index, 1, cyclic);
  if (before < 0 || after < 0 || before === after) return null;
  const incoming = segments[before];
  const outgoing = segments[after];
  if (incoming.type !== "L" || outgoing.type !== "L") return null;
  if (distance(incoming.from, incoming.to) <= 1e-6 || distance(outgoing.from, outgoing.to) <= 1e-6) return null;
  const { cx, cy, rx, ry, delta } = arcCenter(arc);
  if (Math.abs(rx - ry) > 1e-3 * Math.max(rx, ry)) return null;
  const r = rx;
  const center = [cx, cy];
  const u = unit(sub(incoming.to, incoming.from));
  const w = unit(sub(outgoing.to, outgoing.from));
  const turn = Math.acos(Math.max(-1, Math.min(1, dot(u, w))));
  if (turn < minTurn || turn > maxTurn) return null;
  if (Math.abs(Math.abs(delta) - turn) > tolerance) return null;
  if (Math.sign(cross(u, w)) !== Math.sign(delta)) return null;
  // Each line must touch the arc's circle where it meets the arc.
  if (Math.abs(dot(u, sub(center, arc.from))) / r > tolerance) return null;
  if (Math.abs(dot(w, sub(center, arc.to))) / r > tolerance) return null;
  // The vertex is where the two lines meet, so the smoothed corner keeps both lines exactly.
  const vertex = add(arc.from, scale(u, cross(sub(arc.to, arc.from), w) / cross(u, w)));
  const tangent = r * Math.tan(turn / 2);
  return {
    index,
    before,
    after,
    r,
    turn,
    tangent,
    vertex,
    u,
    w,
    inIn: inwardNormal(u, arc.from, center),
    outIn: inwardNormal(w, arc.to, center),
    sweep: arc.sweep,
  };
}

/**
 * How far one corner may reach along a line: the arc's own tangent length plus
 * the straight run, which is shared with a rounded corner at its other end in
 * proportion to the two corners' tangent lengths. `edge` is the full edge
 * length, vertex to vertex (or vertex to the line's free end).
 */
function reach(corner, line, other) {
  const run = distance(line.from, line.to);
  if (!other) return { budget: corner.tangent + run, edge: corner.tangent + run };
  return {
    budget: corner.tangent + (run * corner.tangent) / (corner.tangent + other.tangent),
    edge: corner.tangent + run + other.tangent,
  };
}

/** The smoothed curve for one corner, or null when no straight run is left to smooth into. */
function smoothedCorner(corner, limit, smoothing) {
  let r = corner.r;
  let amount = smoothing;
  const tan = Math.tan(corner.turn / 2);
  if ((1 + smoothing) * corner.tangent > limit.budget + 1e-9) {
    const fitted = Math.floor(limit.budget / (1 + smoothing) / tan / radiusStep + 1e-9) * radiusStep;
    if (limit.edge >= fullSmoothingEdge - 1e-6 && corner.turn <= Math.PI / 2 + tolerance && fitted > 0) r = fitted;
    else amount = limit.budget / corner.tangent - 1;
  }
  if (amount <= 1e-3) return null;
  const { vertex, u, w, inIn, outIn } = corner;
  const tangent = r * tan;
  const reachLength = (1 + amount) * tangent;
  const ease = (corner.turn * amount) / 2;
  const handle = r * Math.tan(ease / 2);
  const b = (reachLength - tangent + handle) / 3;
  const a = 2 * b;
  const along = r * Math.sin(ease);
  const across = r * (1 - Math.cos(ease));
  const start = sub(vertex, scale(u, reachLength));
  const arcStart = add(sub(vertex, scale(u, tangent - along)), scale(inIn, across));
  const arcEnd = add(add(vertex, scale(w, tangent - along)), scale(outIn, across));
  const end = add(vertex, scale(w, reachLength));
  return {
    vertex,
    r,
    smoothing: amount,
    start,
    end,
    segments: [
      { type: "C", from: start, c1: add(start, scale(u, a)), c2: sub(vertex, scale(u, tangent - handle)), to: arcStart },
      { type: "A", from: arcStart, rx: r, ry: r, rotation: 0, largeArc: false, sweep: corner.sweep, to: arcEnd },
      { type: "C", from: arcEnd, c1: add(vertex, scale(w, tangent - handle)), c2: sub(end, scale(w, a)), to: end },
    ],
  };
}

function planSubpath(subpath, smoothing) {
  const { segments } = subpath;
  const cyclic = isCyclic(subpath);
  const corners = segments.map((_segment, index) => roundedCorner(segments, index, cyclic));
  return corners.map((corner) => {
    if (!corner) return null;
    const previous = corners[neighbor(segments, corner.before, -1, cyclic)] ?? null;
    const next = corners[neighbor(segments, corner.after, 1, cyclic)] ?? null;
    const incoming = reach(corner, segments[corner.before], previous);
    const outgoing = reach(corner, segments[corner.after], next);
    return smoothedCorner(corner, incoming.budget <= outgoing.budget ? incoming : outgoing, smoothing);
  });
}

function rebuildSubpath(subpath, plans) {
  const { segments } = subpath;
  const cyclic = isCyclic(subpath);
  const output = [];
  segments.forEach((segment, index) => {
    if (plans[index]) {
      output.push(...plans[index].segments);
      return;
    }
    if (segment.type !== "L") {
      output.push(segment);
      return;
    }
    const previous = plans[neighbor(segments, index, -1, cyclic)];
    const next = plans[neighbor(segments, index, 1, cyclic)];
    const from = previous?.end ?? segment.from;
    const to = next?.start ?? segment.to;
    // Drop what is left of a line the corners used up; rounding leaves slivers.
    const usedUp = (previous || next) && distance(from, to) <= 0.01;
    if (!usedUp || segment.closing) output.push({ ...segment, from, to });
  });
  return { ...subpath, start: cyclic ? output[0].from : subpath.start, segments: output };
}

const format = (value) => {
  const rounded = Math.round(value * 1e4) / 1e4;
  return String(Object.is(rounded, -0) ? 0 : rounded);
};
const point = ([x, y]) => `${format(x)} ${format(y)}`;

function serialize(subpaths) {
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

/**
 * Smooth every rounded corner in path data. Returns the input unchanged when
 * it has no plain rounded corner, so smoothing is idempotent.
 */
export function smoothCorners(d, { smoothing = cornerSmoothing } = {}) {
  const subpaths = edgeSubpaths(d);
  const plans = subpaths.map((subpath) => planSubpath(subpath, smoothing));
  if (!plans.some((plan) => plan.some(Boolean))) return d;
  return serialize(subpaths.map((subpath, index) => rebuildSubpath(subpath, plans[index])));
}

/**
 * Smoothing moves a corner's curve, so a stroke that ended on it, like a cup
 * handle meeting the cup, would end inside or short of the new curve. Slide
 * each such stroke end along its last straight segment back onto the new
 * curve. `before` and `after` are an icon's path data, before and after
 * smoothing, in the same order.
 */
export function reattachEnds(before, after) {
  const flatten = (paths) => paths.flatMap((subpaths, path) => subpaths.map((subpath) => ({ path, subpath })));
  const oldSubpaths = flatten(before.map((d) => parsePath(d)));
  const newPaths = after.map((d) => parsePath(d));
  const newSubpaths = flatten(newPaths);
  if (oldSubpaths.length !== newSubpaths.length) return after;
  const oldSamples = oldSubpaths.map(({ subpath }) => sampleSubpath(subpath, 0.02));
  const newSamples = newSubpaths.map(({ subpath }) => sampleSubpath(subpath, 0.01));
  const nearest = (point, samples) => Math.min(...samples.map((p) => distance(p, point)));
  const changed = new Set();

  newSubpaths.forEach(({ path, subpath }, index) => {
    const { segments } = subpath;
    if (segments.length === 0 || isCyclic(subpath)) return;
    const oldSubpath = oldSubpaths[index].subpath;
    for (const atEnd of [false, true]) {
      const segment = atEnd ? segments.at(-1) : segments[0];
      if (segment.type !== "L") continue;
      const end = atEnd ? segment.to : segment.from;
      const oldEnd = atEnd ? oldSubpath.segments.at(-1).to : oldSubpath.start;
      if (distance(end, oldEnd) > 1e-6) continue;
      // The stroke it ended on: another subpath, in a path smoothing changed,
      // that it touched before. Gaps under 0.03px are rounding, not a detachment.
      const target = oldSamples.findIndex(
        (samples, other) => other !== index && before[newSubpaths[other].path] !== after[newSubpaths[other].path] && nearest(oldEnd, samples) <= 0.02,
      );
      if (target < 0 || nearest(end, newSamples[target]) <= 0.03) continue;
      const anchor = atEnd ? segment.from : segment.to;
      const direction = unit(sub(end, anchor));
      // Where the line through this segment crosses the target's new curve, nearest the old end.
      let best = null;
      const samples = newSamples[target];
      for (let i = 1; i < samples.length; i += 1) {
        const p = samples[i - 1];
        const q = samples[i];
        const edge = sub(q, p);
        const denominator = cross(direction, edge);
        if (Math.abs(denominator) < 1e-9) continue;
        const t = cross(sub(p, anchor), edge) / denominator;
        const s = cross(sub(p, anchor), direction) / denominator;
        if (s < 0 || s > 1 || t <= 0) continue;
        const hit = add(anchor, scale(direction, t));
        if (distance(hit, end) <= 1 && (!best || distance(hit, end) < distance(best, end))) best = hit;
      }
      if (!best || distance(best, anchor) < 0.05) continue;
      if (atEnd) segment.to = best;
      else {
        segment.from = best;
        subpath.start = best;
      }
      changed.add(path);
    }
  });
  return after.map((d, path) => (changed.has(path) ? serialize(newPaths[path]) : d));
}

/** Plain rounded corners that `smoothCorners` would still change, with their vertex and radius. */
export function findUnsmoothedCorners(d, { smoothing = cornerSmoothing } = {}) {
  return edgeSubpaths(d).flatMap((subpath) =>
    planSubpath(subpath, smoothing)
      .filter(Boolean)
      .map(({ vertex, r }) => ({ x: vertex[0], y: vertex[1], r })),
  );
}

// Path data is rounded to 3 decimals, so allow a few thousandths of drift.
const onLine = (origin, direction, p) => Math.abs(cross(direction, sub(p, origin))) <= 0.005;

// Unit tangent at the start (`atEnd` false) or end of a cubic, skipping coincident controls.
function cubicTangent(segment, atEnd) {
  const points = atEnd
    ? [segment.to, segment.c2, segment.c1, segment.from]
    : [segment.from, segment.c1, segment.c2, segment.to];
  const other = points.slice(1).find((p) => distance(p, points[0]) > 1e-6);
  if (!other) return null;
  return atEnd ? unit(sub(points[0], other)) : unit(sub(other, points[0]));
}

/**
 * Every corner in path data drawn with a circular arc: plain rounded corners
 * (smoothing 0) and smoothed ones (cubic, arc, cubic). The smoothing of a
 * smoothed corner is the share of its turn taken by the two cubics.
 */
export function measureCorners(d) {
  const corners = [];
  for (const subpath of edgeSubpaths(d)) {
    const { segments } = subpath;
    const cyclic = isCyclic(subpath);
    segments.forEach((segment, index) => {
      const plain = roundedCorner(segments, index, cyclic);
      if (plain) {
        corners.push({ vertex: plain.vertex, r: plain.r, turn: plain.turn, smoothing: 0 });
        return;
      }
      if (segment.type !== "A" || segment.largeArc) return;
      const before = segments[neighbor(segments, index, -1, cyclic)];
      const after = segments[neighbor(segments, index, 1, cyclic)];
      if (before?.type !== "C" || after?.type !== "C" || before === after) return;
      const { cx, cy, rx, ry, delta } = arcCenter(segment);
      if (Math.abs(rx - ry) > 1e-3 * Math.max(rx, ry)) return;
      const center = [cx, cy];
      const intoArc = cubicTangent(before, true);
      const outOfArc = cubicTangent(after, false);
      const u = cubicTangent(before, false);
      const w = cubicTangent(after, true);
      if (!intoArc || !outOfArc || !u || !w) return;
      // The cubics must meet the arc tangentially, and both handles of each
      // cubic sit on its edge line, as Figma's construction places them.
      if (Math.abs(dot(intoArc, sub(center, segment.from))) / rx > tolerance) return;
      if (Math.abs(dot(outOfArc, sub(center, segment.to))) / rx > tolerance) return;
      if (!onLine(before.from, u, before.c2) || !onLine(after.to, w, after.c1)) return;
      const turn = Math.acos(Math.max(-1, Math.min(1, dot(u, w))));
      if (turn < minTurn || turn > maxTurn || Math.abs(delta) > turn + tolerance) return;
      if (Math.sign(cross(u, w)) !== Math.sign(delta)) return;
      corners.push({ vertex: null, r: rx, turn, smoothing: 1 - Math.abs(delta) / turn });
    });
  }
  return corners;
}
