import { describe, expect, test } from "bun:test";
import { nameFields, searchIcons } from "../search";

const entries = [
  { ...nameFields("arrow-down-0-1"), tags: ["sort"], categories: ["arrows"], categoryTitles: ["arrows"] },
  { ...nameFields("search"), tags: ["find"], categories: ["text"], categoryTitles: ["text formatting"] },
  { ...nameFields("settings"), tags: ["cog"], categories: ["account"], categoryTitles: ["accounts & access"] },
];
const names = (query: string, options = {}) => searchIcons(entries, query, options).map((entry) => entry.name);

describe("searchIcons", () => {
  test("ranks names before tags before categories, keeping the entries' order for ties", () => {
    expect(names("s")).toEqual(["search", "settings", "arrow-down-0-1"]);
    expect(names("se")).toEqual(["search", "settings"]);
    expect(names("formatting")).toEqual(["search"]);
  });

  test("matches names loosely and forgives typos only when asked", () => {
    expect(names("arrow_down")).toEqual([]);
    expect(names("arrow_down", { looseNames: true })).toEqual(["arrow-down-0-1"]);
    expect(names("serch")).toEqual([]);
    expect(names("serch", { typos: true })).toEqual(["search"]);
  });

  test("filters by category id", () => {
    expect(names("", { category: "text" })).toEqual(["search"]);
    expect(names("cog", { category: "text" })).toEqual([]);
  });
});
