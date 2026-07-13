import { describe, expect, test } from "bun:test";
import {
  getMissingIcons,
  parseBatchSize,
  parsePopularFeed,
  toIconSlug,
} from "../src/catalog";
import { resolveLucideIconName } from "../src/lucide";

describe("toIconSlug", () => {
  test("normalizes Lucide component names to Vadivam slugs", () => {
    expect(toIconSlug("Trash2")).toBe("trash-2");
    expect(toIconSlug("ALargeSmall")).toBe("a-large-small");
    expect(toIconSlug("FileJson2")).toBe("file-json-2");
    expect(toIconSlug("X")).toBe("x");
  });
});

describe("resolveLucideIconName", () => {
  test("preserves canonical separators lost in component names", () => {
    expect(resolveLucideIconName("ArrowDown01")).toBe("arrow-down-0-1");
    expect(resolveLucideIconName("ArrowDown10")).toBe("arrow-down-1-0");
    expect(resolveLucideIconName("ArrowDownAZ")).toBe("arrow-down-a-z");
    expect(resolveLucideIconName("ArrowDownZA")).toBe("arrow-down-z-a");
    expect(resolveLucideIconName("arrow-up-0-1")).toBe("arrow-up-0-1");
    expect(resolveLucideIconName("made-up-icon")).toBeNull();
  });

  test("gives ranked component names their canonical Lucide slug", () => {
    const feed = parsePopularFeed(
      {
        icons: [{ name: "ArrowUpAZ", repositories: 1, files: 1, rank: 1 }],
      },
      resolveLucideIconName,
    );
    expect(feed.icons[0]?.slug).toBe("arrow-up-a-z");
  });
});

describe("parsePopularFeed", () => {
  test("validates, deduplicates, and sorts ranked icons", () => {
    const feed = parsePopularFeed({
      methodology: { scannedAt: "2026-07-13", ranking: "Repository count" },
      icons: [
        { name: "Search", repositories: 20, files: 30, rank: 2 },
        { name: "X", repositories: 30, files: 40, rank: 1 },
        { name: "Search", repositories: 10, files: 10, rank: 3 },
      ],
    });
    expect(feed.icons.map((icon) => icon.slug)).toEqual(["x", "search"]);
    expect(feed.scannedAt).toBe("2026-07-13");
  });

  test("rejects unsafe or malformed names", () => {
    expect(() =>
      parsePopularFeed({
        icons: [
          { name: "<script>", repositories: 1, files: 1, rank: 1 },
        ],
      }),
    ).toThrow("invalid icon name");
  });
});

test("getMissingIcons excludes icons already present in the file", () => {
  const feed = parsePopularFeed({
    icons: [
      { name: "X", repositories: 2, files: 3, rank: 1 },
      { name: "Search", repositories: 1, files: 2, rank: 2 },
    ],
  });
  expect(getMissingIcons(feed.icons, new Set(["x"]))[0]?.slug).toBe("search");
});

test("parseBatchSize clamps user input to a safe range", () => {
  expect(parseBatchSize(0)).toBe(1);
  expect(parseBatchSize(20)).toBe(20);
  expect(parseBatchSize(500)).toBe(100);
  expect(() => parseBatchSize(2.5)).toThrow("integer");
});
