import { expect, test } from "bun:test";
import { getBatchPositions, getGridPositions, parseColumns } from "../src/layout";

test("places a new batch one canonical row below existing icons", () => {
  expect(
    getBatchPositions(
      3,
      40,
      [
        { x: 0, y: 0 },
        { x: 40, y: 72 },
      ],
      { x: 500, y: 500 },
    ),
  ).toEqual([
    { x: 0, y: 144 },
    { x: 40, y: 144 },
    { x: 80, y: 144 },
  ]);
});

test("wraps a new batch at the chosen column count", () => {
  expect(getBatchPositions(3, 2, [{ x: 0, y: 0 }], { x: 0, y: 0 })).toEqual([
    { x: 0, y: 72 },
    { x: 40, y: 72 },
    { x: 0, y: 144 },
  ]);
});

test("snaps empty files to the viewport grid", () => {
  expect(getBatchPositions(1, 40, [], { x: 53, y: 80 })).toEqual([
    { x: 40, y: 72 },
  ]);
});

test("arranges exactly the chosen number of icons per row", () => {
  const positions = getGridPositions(41, 40, { x: 0, y: 0 });
  expect(positions[39]).toEqual({ x: 1560, y: 0 });
  expect(positions[40]).toEqual({ x: 0, y: 72 });
  expect(getGridPositions(3, 2, { x: 0, y: 0 })[2]).toEqual({ x: 0, y: 72 });
});

test("clamps columns to a usable range", () => {
  expect(parseColumns(0)).toBe(1);
  expect(parseColumns(24)).toBe(24);
  expect(parseColumns(500)).toBe(100);
  expect(() => parseColumns(2.5)).toThrow("Columns must be a whole number");
  expect(() => parseColumns("40")).toThrow("Columns must be a whole number");
});
