import { describe, expect, test } from "bun:test";
import {
  getMissingIcons,
  parseBatchSize,
  parseLucideCatalog,
} from "../src/catalog";
import deprecatedAliases from "../src/data/lucide-deprecated-aliases.json";
import rankings from "../src/data/lucide-icon-rankings.json";
import {
  getDeprecatedLucideReplacement,
  lucideIconNames,
  resolveLucideIconName,
} from "../src/lucide";

describe("resolveLucideIconName", () => {
  test("preserves canonical separators lost in component names", () => {
    expect(resolveLucideIconName("ArrowDown01")).toBe("arrow-down-0-1");
    expect(resolveLucideIconName("ArrowDown10")).toBe("arrow-down-1-0");
    expect(resolveLucideIconName("ArrowDownAZ")).toBe("arrow-down-a-z");
    expect(resolveLucideIconName("ArrowDownZA")).toBe("arrow-down-z-a");
    expect(resolveLucideIconName("arrow-up-0-1")).toBe("arrow-up-0-1");
    expect(resolveLucideIconName("made-up-icon")).toBeNull();
  });

  test("keeps deprecated aliases out of the canonical catalog", () => {
    expect(resolveLucideIconName("columns")).toBeNull();
    expect(getDeprecatedLucideReplacement("columns")).toBe("columns-2");
    expect(getDeprecatedLucideReplacement("Columns")).toBe("columns-2");
    expect(getDeprecatedLucideReplacement("CircleEuroSign")).toBe("circle-euro");
    expect(
      Object.keys(deprecatedAliases).every((alias) => !lucideIconNames.includes(alias)),
    ).toBe(true);
    expect(
      Object.values(deprecatedAliases).every((name) => lucideIconNames.includes(name)),
    ).toBe(true);
  });

});

describe("parseLucideCatalog", () => {
  test("validates canonical names and popularity order", () => {
    const catalog = parseLucideCatalog({
      lucideVersion: "1.30.0",
      retrievedAt: "2026-08-08T00:00:00.000Z",
      source: "https://lucide.dev/icons/",
      ranking: "Lucide icon-page visitors over the last 12 months",
      icons: [
        { name: "search", popularity: 20, rank: 2 },
        { name: "x", popularity: 30, rank: 1 },
      ],
    }, resolveLucideIconName);
    expect(catalog.icons.map((icon) => icon.name)).toEqual(["x", "search"]);
    expect(catalog.lucideVersion).toBe("1.30.0");
  });

  test("rejects deprecated, unsafe, duplicate, or out-of-order data", () => {
    const base = {
      lucideVersion: "1.30.0",
      retrievedAt: "2026-08-08T00:00:00.000Z",
      source: "https://lucide.dev/icons/",
      ranking: "Lucide icon-page visitors over the last 12 months",
    };
    expect(() =>
      parseLucideCatalog({
        ...base,
        icons: [{ name: "columns", popularity: 1, rank: 1 }],
      }, resolveLucideIconName),
    ).toThrow("non-canonical");
    expect(() =>
      parseLucideCatalog({
        ...base,
        icons: [{ name: "<script>", popularity: 1, rank: 1 }],
      }, resolveLucideIconName),
    ).toThrow("invalid icon name");
    expect(() =>
      parseLucideCatalog({
        ...base,
        icons: [
          { name: "x", popularity: 1, rank: 1 },
          { name: "x", popularity: 1, rank: 2 },
        ],
      }, resolveLucideIconName),
    ).toThrow("duplicate icon name");
    expect(() =>
      parseLucideCatalog({
        ...base,
        icons: [
          { name: "x", popularity: 1, rank: 1 },
          { name: "search", popularity: 2, rank: 2 },
        ],
      }, resolveLucideIconName),
    ).toThrow("not sorted by popularity");
  });

  test("bundles every canonical Lucide 1.30.0 name in official popularity order", () => {
    const catalog = parseLucideCatalog(rankings, resolveLucideIconName);
    expect(catalog.lucideVersion).toBe("1.30.0");
    expect(catalog.icons).toHaveLength(lucideIconNames.length);
    expect(catalog.icons.map((icon) => icon.name).sort()).toEqual(
      Array.from(lucideIconNames),
    );
    expect(catalog.icons.slice(0, 5).map((icon) => icon.name)).toEqual([
      "x",
      "check",
      "search",
      "chevron-down",
      "plus",
    ]);
  });
});

test("getMissingIcons excludes icons already present in the file", () => {
  const catalog = parseLucideCatalog({
    lucideVersion: "1.30.0",
    retrievedAt: "2026-08-08T00:00:00.000Z",
    source: "https://lucide.dev/icons/",
    ranking: "Lucide icon-page visitors over the last 12 months",
    icons: [
      { name: "x", popularity: 2, rank: 1 },
      { name: "search", popularity: 1, rank: 2 },
    ],
  }, resolveLucideIconName);
  expect(getMissingIcons(catalog.icons, new Set(["x"]))[0]?.name).toBe("search");
});

test("parseBatchSize clamps user input to a safe range", () => {
  expect(parseBatchSize(0)).toBe(1);
  expect(parseBatchSize(20)).toBe(20);
  expect(parseBatchSize(500)).toBe(100);
  expect(() => parseBatchSize(2.5)).toThrow("integer");
});
