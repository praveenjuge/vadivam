// Tidies the centerline paths Figma exports before corner smoothing runs.
//
// Figma splits a drawn outline into many subpaths wherever strokes meet, and
// leaves debris behind: lone moveto commands, and zero-length stubs sitting on
// another stroke. With round caps and joins, two strokes that end at the same
// point render exactly like one stroke turning there (the round join covers
// the same disc as the two round caps), so joining them changes no pixels. A
// joined outline also lets corner smoothing see both sides of each corner.
//
// Exports also leave horizontal and vertical lines a few hundredths of a pixel
// off the whole-pixel grid, which blurs them at 24px. Those are snapped onto it.

import { parsePath, sampleSegment, sampleSubpath, segmentLength, serializePath } from "./icon-geometry.mjs";

// Figma rounds coordinates to 3 decimals, so ends this close are one point.
const joinTolerance = 0.01;
// A subpath shorter than this is a dot (Lucide draws them as `h.01`) or debris.
const stubLength = 0.05;
// A stub this close to another stroke is hidden under it.
const coveredDistance = 0.05;
// A horizontal or vertical line at least this long, and less than this far off
// a whole pixel, is snapped onto it. Offsets of 0.1px or more are drawn on purpose.
export const gridLineLength = 1;
export const gridTolerance = 0.1;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const unit = (a) => {
  const length = Math.hypot(a[0], a[1]);
  return length > 1e-12 ? [a[0] / length, a[1] / length] : [0, 0];
};

const endPoint = (subpath) => subpath.segments.at(-1)?.to ?? subpath.start;
const subpathLength = (subpath) => subpath.segments.reduce((total, segment) => total + segmentLength(segment), 0);

function reverseSegment(segment) {
  const reversed = { ...segment, from: segment.to, to: segment.from };
  delete reversed.closing;
  if (segment.type === "C") Object.assign(reversed, { c1: segment.c2, c2: segment.c1 });
  if (segment.type === "A") reversed.sweep = !segment.sweep;
  return reversed;
}

function reverseSubpath(subpath) {
  return { ...subpath, start: endPoint(subpath), segments: subpath.segments.map(reverseSegment).reverse() };
}

// The unit direction pointing out of the subpath at its start or end.
function outward(subpath, atEnd) {
  const segment = atEnd ? subpath.segments.at(-1) : subpath.segments[0];
  const points = sampleSegment(segment, 64);
  if (!atEnd) points.reverse();
  const tip = points.at(-1);
  const inner = points.slice(0, -1).reverse().find((point) => distance(point, tip) > 1e-6);
  return inner ? unit(sub(tip, inner)) : [0, 0];
}

/** Lone movetos, and stubs hidden under another stroke, which add nothing to the drawing. */
function isDebris(subpath, others) {
  if (subpath.segments.length === 0 && !subpath.closed) return true;
  if (subpathLength(subpath) >= stubLength) return false;
  const points = [subpath.start, ...subpath.segments.map((segment) => segment.to)];
  return others.some((samples) => points.every((point) => samples.some((sample) => distance(sample, point) <= coveredDistance)));
}

/**
 * Pair up open subpath ends that meet, preferring pairs that continue each
 * other smoothly so a stroke crossing a junction stays one stroke.
 */
function pairEnds(subpaths) {
  const ends = subpaths.flatMap((subpath, index) =>
    subpath.closed || subpath.segments.length === 0
      ? []
      : [false, true].map((atEnd) => ({ index, atEnd, point: atEnd ? endPoint(subpath) : subpath.start, out: outward(subpath, atEnd) })),
  );
  const candidates = [];
  for (let i = 0; i < ends.length; i += 1) {
    for (let j = i + 1; j < ends.length; j += 1) {
      const [a, b] = [ends[i], ends[j]];
      // A subpath whose ends meet already renders as a loop, so it is left as is.
      if (a.index === b.index || distance(a.point, b.point) > joinTolerance) continue;
      // Smooth continuation has opposite outward directions: score 0. A cusp scores 2.
      candidates.push({ a, b, score: 1 + a.out[0] * b.out[0] + a.out[1] * b.out[1] });
    }
  }
  candidates.sort((x, y) => x.score - y.score);
  const links = new Map();
  const key = ({ index, atEnd }) => `${index}:${atEnd}`;
  for (const { a, b } of candidates) {
    if (links.has(key(a)) || links.has(key(b))) continue;
    links.set(key(a), b);
    links.set(key(b), a);
  }
  return { links, key };
}

function joinSubpaths(subpaths) {
  const { links, key } = pairEnds(subpaths);
  if (links.size === 0) return { subpaths, joins: 0 };
  const visited = new Set();
  const output = [];
  subpaths.forEach((subpath, first) => {
    if (visited.has(first)) return;
    if (!links.has(key({ index: first, atEnd: false })) && !links.has(key({ index: first, atEnd: true }))) {
      visited.add(first);
      output.push(subpath);
      return;
    }
    // Walk back to the free end this chain starts from; a cycle starts here.
    let index = first;
    let startsAtEnd = false;
    let cyclic = false;
    for (;;) {
      const previous = links.get(key({ index, atEnd: startsAtEnd }));
      if (!previous) break;
      index = previous.index;
      startsAtEnd = !previous.atEnd;
      if (index === first && !startsAtEnd) {
        cyclic = true;
        break;
      }
    }
    const chain = { start: null, closed: false, segments: [] };
    for (;;) {
      visited.add(index);
      const oriented = startsAtEnd ? reverseSubpath(subpaths[index]) : subpaths[index];
      if (!chain.start) chain.start = oriented.start;
      oriented.segments.forEach((segment, position) => {
        const from = position === 0 ? endPoint(chain) : segment.from;
        chain.segments.push({ ...segment, from });
      });
      const next = links.get(key({ index, atEnd: !startsAtEnd }));
      if (!next || visited.has(next.index)) break;
      index = next.index;
      startsAtEnd = next.atEnd;
    }
    // A loop stays open, as SVGO would reopen it, with its last end snapped onto its start.
    if (cyclic) chain.segments.push({ ...chain.segments.pop(), to: chain.start });
    output.push(chain);
  });
  return { subpaths: output, joins: links.size / 2 };
}

// Straight runs split into pieces become one line, and lines shorter than a
// stub inside a longer stroke go: they are stray nodes from the export.
function mergeLines(subpath) {
  const segments = [];
  let merges = 0;
  let nodes = 0;
  for (const segment of subpath.segments) {
    const last = segments.at(-1);
    const length = distance(segment.from, segment.to);
    if (segment.type === "L" && !segment.closing && subpath.segments.length > 1 && length < stubLength) {
      if (last) last.to = segment.to;
      if (length <= 1e-4) merges += 1;
      else nodes += 1;
      continue;
    }
    if (last?.type === "L" && segment.type === "L") {
      const a = unit(sub(last.to, last.from));
      const b = unit(sub(segment.to, segment.from));
      if (a[0] * b[0] + a[1] * b[1] > 1 - 1e-6) {
        segments[segments.length - 1] = { ...last, to: segment.to };
        merges += 1;
        continue;
      }
    }
    segments.push({ ...segment });
  }
  return { subpath: { ...subpath, segments }, merges, nodes };
}

/** Coordinates of horizontal (axis 1) and vertical (axis 0) lines just off a whole pixel. */
export function offGridLines(subpaths) {
  const lines = [];
  for (const segment of subpaths.flatMap((subpath) => subpath.segments)) {
    if (segment.type !== "L" || distance(segment.from, segment.to) < gridLineLength) continue;
    const axis = Math.abs(segment.from[1] - segment.to[1]) <= 1e-6 ? 1 : Math.abs(segment.from[0] - segment.to[0]) <= 1e-6 ? 0 : -1;
    if (axis < 0) continue;
    const value = segment.from[axis];
    const offset = Math.abs(value - Math.round(value));
    if (offset > 1e-3 && offset < gridTolerance - 1e-6) lines.push({ axis, value });
  }
  return lines;
}

// Move every coordinate equal to an off-grid line's onto the whole pixel, so
// strokes that meet the line move with it.
function snapToGrid(subpaths, lines) {
  const snapValue = (value, axis) => {
    const line = lines.find((candidate) => candidate.axis === axis && Math.abs(candidate.value - value) <= 2e-3);
    return line ? Math.round(line.value) : value;
  };
  const snap = (point) => point && [snapValue(point[0], 0), snapValue(point[1], 1)];
  return subpaths.map((subpath) => ({
    ...subpath,
    start: snap(subpath.start),
    segments: subpath.segments.map((segment) => ({
      ...segment,
      from: snap(segment.from),
      to: snap(segment.to),
      ...(segment.c1 && { c1: snap(segment.c1), c2: snap(segment.c2) }),
      ...(segment.c && { c: snap(segment.c) }),
    })),
  }));
}

/**
 * Clean one icon's path data. `paths` is the `d` of each `<path>`, in order;
 * stubs are compared against every path, and joins stay within one path.
 * Returns the cleaned path data, with null for a path left with nothing to
 * draw, and how many fixes of each kind were made.
 */
export function cleanPaths(paths) {
  const parsed = paths.map((d) => parsePath(d));
  const all = parsed.flat();
  const long = all.map((subpath) => subpathLength(subpath) >= stubLength);
  // Only stubs need the other strokes sampled, to see whether they are hidden.
  const samples = long.every(Boolean) ? [] : all.map((subpath, index) => (long[index] ? sampleSubpath(subpath, 0.02) : null));
  const counts = { debris: 0, joins: 0, merges: 0, nodes: 0, snaps: 0 };
  const lines = offGridLines(all);
  counts.snaps = new Set(lines.map(({ axis, value }) => `${axis}:${value}`)).size;
  const cleaned = parsed.map((subpaths) => {
    const kept = subpaths.filter((subpath) => {
      const others = samples.filter((points, index) => points && all[index] !== subpath);
      const debris = isDebris(subpath, others);
      if (debris) counts.debris += 1;
      return !debris;
    });
    // A loop closed by one round leaves its meeting point free for another stroke.
    let joined = { subpaths: kept, joins: 1 };
    while (joined.joins > 0) {
      joined = joinSubpaths(joined.subpaths);
      counts.joins += joined.joins;
    }
    const snapped = lines.length ? snapToGrid(joined.subpaths, lines) : joined.subpaths;
    return snapped.map((subpath) => {
      const merged = mergeLines(subpath);
      counts.merges += merged.merges;
      counts.nodes += merged.nodes;
      return merged.subpath;
    });
  });
  const changed = counts.debris + counts.joins + counts.merges + counts.nodes + counts.snaps > 0;
  return {
    paths: changed ? cleaned.map((subpaths) => (subpaths.length ? serializePath(subpaths) : null)) : paths,
    ...counts,
  };
}
