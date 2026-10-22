import { describe, expect, test } from "bun:test";
import { createEntries, searchIcons } from "../src/catalog";

const entries = createEntries(
  [
    ["arrow-down-0-1", ["sort", "ascending"], ["arrows", "text"]],
    ["badge-dollar-sign", ["money", "$"], ["finance"]],
    ["search", ["find", "magnifier"], ["text"]],
    ["settings", ["cog", "preferences"], ["account"]],
    ["trash-2", ["garbage", "delete", "remove"], ["files"]],
    ["x", ["cancel", "close", "delete", "remove"], ["math"]],
  ],
  new Map([
    ["account", "Accounts & access"],
    ["arrows", "Arrows"],
    ["files", "Files"],
    ["finance", "Finance"],
    ["math", "Math"],
    ["text", "Text formatting"],
  ]),
);
const names = (query: string, category?: string) =>
  searchIcons(entries, query, category).map((entry) => entry.name);

describe("searchIcons", () => {
  test("returns the full catalog in source order for an empty query", () => {
    expect(names("")).toEqual([
      "arrow-down-0-1",
      "badge-dollar-sign",
      "search",
      "settings",
      "trash-2",
      "x",
    ]);
  });

  test("ranks exact, separator-free, prefix, substring, and typo matches", () => {
    expect(names("trash-2")[0]).toBe("trash-2");
    expect(names("ArrowDown01")[0]).toBe("arrow-down-0-1");
    expect(names("set")[0]).toBe("settings");
    expect(names("arch")[0]).toBe("search");
    expect(names("serch")[0]).toBe("search");
  });

  test("finds icons by Lucide tags and category titles after name matches", () => {
    expect(names("close")).toEqual(["x"]);
    expect(names("delete")).toEqual(["x", "trash-2"]);
    expect(names("cog")).toEqual(["settings"]);
    expect(names("formatting")).toEqual(["search", "arrow-down-0-1"]);
  });

  test("finds symbol-only tags instead of treating them as an empty query", () => {
    expect(names("$")).toEqual(["badge-dollar-sign"]);
    expect(names("arrow_down")).toEqual(["arrow-down-0-1"]);
    expect(names("sort, ascending")).toEqual(["arrow-down-0-1"]);
    expect(names("garbage.")).toEqual(["trash-2"]);
  });

  test("requires every word and joins words into hyphenated names", () => {
    expect(names("arrow down")).toEqual(["arrow-down-0-1"]);
    expect(names("delete garbage")).toEqual(["trash-2"]);
  });

  test("filters by category id", () => {
    expect(names("", "text")).toEqual(["arrow-down-0-1", "search"]);
    expect(names("find", "text")).toEqual(["search"]);
    expect(names("find", "files")).toEqual([]);
  });
});
