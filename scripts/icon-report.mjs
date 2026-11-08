// Measures every outline icon and prints the numbers the design guide at
// /docs/design-guide is written from.
// Usage: bun scripts/icon-report.mjs
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cornerSmoothing, fullSmoothingEdge, measureCorners } from "./corner-smoothing.mjs";
import { bounds, detectCircle, detectRoundedRect, gridClass, inkBounds, parsePath, sampleSubpath, segmentLength } from "./icon-geometry.mjs";
import { svgPathData } from "./icon-styles.mjs";

const near = (a, b, tolerance) => Math.abs(a - b) <= tolerance;

/** Bounding box of the drawn ink: the centerline expanded by half the stroke width. */
function strokeBounds(svg, strokeWidth = 2) {
  return inkBounds(svgPathData(svg).map((d) => ["path", { d }]), strokeWidth);
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
function analyzeIcon(svg, { gaps = false } = {}) {
  const pathData = svgPathData(svg);
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

async function report(iconsDir) {
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
  const decimals = icons.flatMap(({ svg }) => svgPathData(svg).flatMap((d) => (d.match(/\.\d+/g) ?? []).map((m) => m.length - 1)));
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
  const corners = icons.flatMap(({ svg }) => svgPathData(svg).flatMap((d) => measureCorners(d)));
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
  const maxClosed = results.flatMap((r) => svgPathData(r.svg).map((d) => (d.match(/z/gi) ?? []).length));
  line(`Most closed subpaths in one <path>: ${Math.max(...maxClosed)}`);
  const unclosedSingle = results.filter((r) => r.subpaths === 0);
  line(`Icons with no subpaths: ${unclosedSingle.length}`);
  const zeroLength = results.filter((r) => svgPathData(r.svg).flatMap((d) => parsePath(d)).some((s) => s.segments.length === 0));
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
