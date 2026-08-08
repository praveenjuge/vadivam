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

test("arranges exactly 40 icons per row", () => {
  const positions = getGridPositions(41, 40, { x: 0, y: 0 });
  expect(positions[39]).toEqual({ x: 1560, y: 0 });
  expect(positions[40]).toEqual({ x: 0, y: 72 });
});
