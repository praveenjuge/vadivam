import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { area, draftSolid, loadPathKit, pathDataOf, solidPath, solidSvg, toPathData } from "../scripts/solid-draft.mjs";

const PK = await loadPathKit();
const outline = (name) => pathDataOf(readFileSync(new URL(`../icons/${name}.svg`, import.meta.url), "utf8"));
const inkCircle = Math.PI * 11 ** 2;

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

  test("writes conic arcs as cubics that keep the shape", () => {
    const circle = solidPath(PK, solidSvg("M1 12a11 11 0 1 0 22 0a11 11 0 1 0-22 0Z"));
    expect(circle.toCmds().some(([verb]) => verb === 3)).toBe(true);
    const redrawn = solidPath(PK, solidSvg(toPathData(circle)));
    expect(Math.abs(area(redrawn) - area(circle))).toBeLessThan(0.2);
  });
});
