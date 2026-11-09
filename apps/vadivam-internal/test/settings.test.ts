import { expect, test } from "bun:test";
import { clampCount, COUNT_LIMITS } from "../src/settings";

test("brings whole numbers into each setting's range", () => {
  expect(clampCount("batchSize", 0)).toBe(1);
  expect(clampCount("batchSize", 20)).toBe(20);
  expect(clampCount("batchSize", 500)).toBe(COUNT_LIMITS.batchSize.max);
  expect(clampCount("columns", 500)).toBe(COUNT_LIMITS.columns.max);
});

test("rejects anything that isn't a whole number", () => {
  expect(clampCount("columns", 2.5)).toBeNull();
  expect(clampCount("columns", "40")).toBeNull();
  expect(clampCount("columns", Number.NaN)).toBeNull();
  expect(clampCount("columns", undefined)).toBeNull();
});
