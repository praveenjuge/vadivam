import { expect, test } from "bun:test";
import { getBatchPositions, getGridPositions } from "../src/layout";

test("places a new batch one canonical row below existing icons", () => {
  expect(
    getBatchPositions(
      3,
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

test("snaps empty files to the viewport grid", () => {
  expect(getBatchPositions(1, [], { x: 53, y: 80 })).toEqual([
    { x: 40, y: 72 },
  ]);
});

test("arranges exactly 20 icons per row", () => {
  const positions = getGridPositions(21, 20, { x: 0, y: 0 });
  expect(positions[19]).toEqual({ x: 760, y: 0 });
  expect(positions[20]).toEqual({ x: 0, y: 72 });
});
