import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { area, draftSolid, loadPathKit, pathDataOf, solidPath, solidSvg, toPathData } from "../scripts/solid-draft.mjs";

const PK = await loadPathKit();
const outline = (name) => pathDataOf(readFileSync(new URL(`../icons/${name}.svg`, import.meta.url), "utf8"));
const inkCircle = Math.PI * 11 ** 2;
// How much of a 1px square centered on a point the draft fills, from 0 to 1.
const coverage = (drafted, [x, y]) => {
  const square = PK.FromSVGString(`M${x - 0.5} ${y - 0.5}h1v1h-1z`).transform(64, 0, 0, 0, 64, 0, 0, 0, 1);
  return area(PK.MakeFromOp(drafted, square, PK.PathOp.INTERSECT));
};
// A stroke of the given width along path data, at the drafts' working scale.
const ink = (d, width) =>
  PK.FromSVGString(d)
    .transform(64, 0, 0, 0, 64, 0, 0, 0, 1)
    .stroke({ width: width * 64, join: PK.StrokeJoin.ROUND, cap: PK.StrokeCap.ROUND })
    .simplify();

describe("solid drafts", () => {
  test("fills a closed shape out to the outline's ink edge", () => {
    expect(area(draftSolid(PK, outline("circle")))).toBeCloseTo(inkCircle, 0);
  });

  test("cuts a line inside a fill out of it", () => {
    const filled = area(draftSolid(PK, outline("circle")));
    const checked = area(draftSolid(PK, outline("circle-check")));
    // The check's 2px cut, about 2px wide along its ~11px length.
    expect(filled - checked).toBeGreaterThan(15);
    expect(filled - checked).toBeLessThan(30);
  });

  test("draws an -off icon as its base with the slash and a gap cut through", () => {
    const base = draftSolid(PK, outline("circle"));
    const off = draftSolid(PK, outline("circle-off"), { base });
    expect(area(off)).toBeLessThan(area(base) - 20);
    // Drafting from the base's saved SVG gives the same icon.
    const saved = solidPath(PK, solidSvg(toPathData(base)));
    expect(area(draftSolid(PK, outline("circle-off"), { base: saved }))).toBeCloseTo(area(off), 0);
  });

  test("reads a saved base's overlapping elements as one filled area", () => {
    // Two overlapping squares, 10x10 each, sharing a 4x4 corner.
    const svg = solidSvg("M4 4h10v10H4z").replace("\n</svg>", '\n<path d="M10 10h10v10H10z"/>\n</svg>');
    const base = solidPath(PK, svg);
    expect(area(base)).toBeCloseTo(184, 1);
    expect(area(solidPath(PK, svg.replace('<path d="M10 10h10v10H10z"/>', '<rect x="10" y="10" width="10" height="10"/>')))).toBeCloseTo(184, 1);
    // Redrafting an -off icon only clears the slash and its gap.
    const off = draftSolid(PK, ["M2 2l20 20"], { base });
    const clearance = ink("M2 2l20 20", 6.5);
    const outside = (path) => area(PK.MakeFromOp(path, clearance, PK.PathOp.DIFFERENCE));
    expect(outside(off)).toBeCloseTo(outside(base), 1);
  });

  test("leaves out subpaths listed under drop", () => {
    // Without its spokes, the cog keeps the fill they were cut from.
    const withSpokes = area(draftSolid(PK, outline("cog")));
    const withoutSpokes = area(draftSolid(PK, outline("cog"), { hints: { drop: [2, 6, 10] } }));
    expect(withoutSpokes).toBeGreaterThan(withSpokes + 1.5);
  });

  test("draws a badge in a shape's gap in front of it with a gap", () => {
    const drafted = draftSolid(PK, outline("file-check-corner"));
    const check = "M4 18.25l2.5 2.5s2.5-3.5 4.5-4.5";
    const checkInk = ink(check, 2.5);
    // The check is drawn whole, and the page stays 2px clear of it.
    expect(area(PK.MakeFromOp(checkInk, drafted, PK.PathOp.DIFFERENCE))).toBeLessThan(0.5);
    const ring = PK.MakeFromOp(ink(check, 6), checkInk, PK.PathOp.DIFFERENCE);
    expect(area(PK.MakeFromOp(ring, drafted, PK.PathOp.INTERSECT))).toBeLessThan(1);
  });

  test("trims a loose line back from a fill instead of cutting the fill", () => {
    const square = "M4 4h10v10H4z";
    const alone = area(draftSolid(PK, [square]));
    // A line 2px from the square's edge leaves the square whole.
    const withLine = draftSolid(PK, [square, "M17 4v10"]);
    const squareOnly = PK.MakeFromOp(withLine, solidPath(PK, solidSvg("M2 2h13.5v14H2z")), PK.PathOp.INTERSECT);
    expect(area(squareOnly)).toBeCloseTo(alone, 0);
    expect(area(withLine)).toBeGreaterThan(alone + 10);
  });

  test("keeps a page whole with its dog-ear as a window inside its edge", () => {
    const drafted = draftSolid(PK, outline("file"));
    // The fold's corner is open, the page's edge beyond it and the page under it filled.
    expect(coverage(drafted, [14, 7])).toBeLessThan(0.05);
    expect(coverage(drafted, [17, 6.5])).toBeGreaterThan(0.95);
    expect(coverage(drafted, [12, 15])).toBeGreaterThan(0.95);
  });

  test("draws a lock in a page's gap in front of it, shackle and all", () => {
    const drafted = draftSolid(PK, outline("file-lock"));
    // The lock's body and shackle are filled, with a gap above the shackle.
    expect(coverage(drafted, [12, 18.5])).toBeGreaterThan(0.95);
    expect(coverage(drafted, [12, 12])).toBeGreaterThan(0.95);
    expect(coverage(drafted, [12, 9.6])).toBeLessThan(0.05);
  });

  test("knocks a lock out of a shield, shackle and all", () => {
    const drafted = draftSolid(PK, outline("shield-lock"));
    expect(coverage(drafted, [12, 12])).toBeLessThan(0.05);
    expect(coverage(drafted, [12, 7])).toBeLessThan(0.05);
    expect(coverage(drafted, [12, 18])).toBeGreaterThan(0.95);
  });

  test("runs a dividing line out through the edges it ends on", () => {
    // A calendar's header line and a bottle's label line, drawn as their own
    // stroke and as part of the shape's stroke, split the fill edge to edge.
    const calendar = draftSolid(PK, outline("calendar"));
    expect(coverage(calendar, [2.1, 9])).toBeLessThan(0.05);
    expect(coverage(calendar, [21.9, 9])).toBeLessThan(0.05);
    const bottle = draftSolid(PK, outline("bottle-wine"));
    expect(coverage(bottle, [7.2, 16])).toBeLessThan(0.05);
    expect(coverage(bottle, [16.8, 16])).toBeLessThan(0.05);
  });

  test("cuts lines inside a shape with a hole", () => {
    // A disc's grooves sit between its rim and its hole; the edges of a
    // shape with a hole must not swallow them.
    const drafted = draftSolid(PK, outline("disc-3"));
    expect(coverage(drafted, [16.2, 7.8])).toBeLessThan(0.05);
    expect(coverage(drafted, [12, 5])).toBeGreaterThan(0.95);
  });

  test("writes conic arcs as cubics that keep the shape", () => {
    const circle = solidPath(PK, solidSvg("M1 12a11 11 0 1 0 22 0a11 11 0 1 0-22 0Z"));
    expect(circle.toCmds().some(([verb]) => verb === 3)).toBe(true);
    const redrawn = solidPath(PK, solidSvg(toPathData(circle)));
    expect(Math.abs(area(redrawn) - area(circle))).toBeLessThan(0.2);
  });
});
