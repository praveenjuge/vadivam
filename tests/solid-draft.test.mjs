import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { area, draftSolid, loadPathKit, pathDataOf, solidPath, solidSvg, toPathData } from "../scripts/solid-draft.mjs";

const PK = await loadPathKit();
const outline = (name) => pathDataOf(readFileSync(new URL(`../icons/${name}.svg`, import.meta.url), "utf8"));
const inkCircle = Math.PI * 11 ** 2;
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

  test("writes conic arcs as cubics that keep the shape", () => {
    const circle = solidPath(PK, solidSvg("M1 12a11 11 0 1 0 22 0a11 11 0 1 0-22 0Z"));
    expect(circle.toCmds().some(([verb]) => verb === 3)).toBe(true);
    const redrawn = solidPath(PK, solidSvg(toPathData(circle)));
    expect(Math.abs(area(redrawn) - area(circle))).toBeLessThan(0.2);
  });
});
