import { describe, expect, test } from "bun:test";
import { searchIcons, type CatalogIcon } from "../src/catalog";

const icons: CatalogIcon[] = [
  { name: "arrow-down-0-1", svg: "<svg />" },
  { name: "search", svg: "<svg />" },
  { name: "settings", svg: "<svg />" },
  { name: "trash-2", svg: "<svg />" },
];

describe("searchIcons", () => {
  test("returns the full catalog alphabetically for an empty query", () => {
    expect(searchIcons([...icons].reverse(), "").map((icon) => icon.name)).toEqual([
      "arrow-down-0-1",
      "search",
      "settings",
      "trash-2",
    ]);
  });

  test("ranks exact, separator-free, prefix, substring, and typo matches", () => {
    expect(searchIcons(icons, "trash-2")[0]?.name).toBe("trash-2");
    expect(searchIcons(icons, "ArrowDown01")[0]?.name).toBe("arrow-down-0-1");
    expect(searchIcons(icons, "set")[0]?.name).toBe("settings");
    expect(searchIcons(icons, "arch")[0]?.name).toBe("search");
    expect(searchIcons(icons, "serch")[0]?.name).toBe("search");
  });

  test("does not invent semantic aliases", () => {
    expect(searchIcons(icons, "delete")).toEqual([]);
  });
});
