import { describe, expect, test } from "bun:test";
import {
  decodeStringLiteral,
  MAX_UNLISTED_ICONS,
  rankLucideIcons,
} from "../scripts/lucide-rankings.mjs";

describe("decodeStringLiteral", () => {
  test("decodes a template-literal JSON payload", () => {
    const source = 'const a=JSON.parse(`{"icons":[{"name":"x","note":"a\\`b\\$c"}]}`);';
    const decoded = decodeStringLiteral(source, source.indexOf("`"));
    expect(JSON.parse(decoded)).toEqual({ icons: [{ name: "x", note: "a`b$c" }] });
  });

  test("rejects template substitutions", () => {
    const source = "`{\"icons\":[${icons}]}`";
    expect(() => decodeStringLiteral(source, 0)).toThrow(
      "Unsupported template substitution in Lucide data",
    );
  });

  test("still decodes single-quoted strings", () => {
    const source = String.raw`JSON.parse('{"name":"it\'s x\x21"}')`;
    const decoded = decodeStringLiteral(source, source.indexOf("'"));
    expect(JSON.parse(decoded)).toEqual({ name: "it's x!" });
  });

  test("decodes Unicode escapes without skipping the next character", () => {
    const source = String.raw`'a\u0041bc\u00e9\"x\u{1F600}\u{41}z'`;
    expect(decodeStringLiteral(source, 0)).toBe('aAbcé"x\u{1F600}Az');
  });

  test("rejects malformed Unicode escapes", () => {
    expect(() => decodeStringLiteral(String.raw`'\u41'`, 0)).toThrow("Invalid Unicode escape in Lucide data");
    expect(() => decodeStringLiteral(String.raw`'\u{}'`, 0)).toThrow("Invalid Unicode escape in Lucide data");
  });
});

describe("rankLucideIcons", () => {
  test("inherits popularity from a deprecated alias", () => {
    const { icons, unlisted } = rankLucideIcons(
      ["circle-euro", "x"],
      new Map([["circle-euro-sign", "circle-euro"]]),
      new Map([
        ["circle-euro-sign", 40],
        ["x", 10],
      ]),
    );
    expect(icons).toEqual([
      { name: "circle-euro", popularity: 40, rank: 1 },
      { name: "x", popularity: 10, rank: 2 },
    ]);
    expect(unlisted).toEqual([]);
  });

  test("ranks unlisted icons with zero popularity", () => {
    const { icons, unlisted } = rankLucideIcons(
      ["certificate", "x"],
      new Map(),
      new Map([["x", 10]]),
    );
    expect(icons).toEqual([
      { name: "x", popularity: 10, rank: 1 },
      { name: "certificate", popularity: 0, rank: 2 },
    ]);
    expect(unlisted).toEqual(["certificate"]);
  });

  test("throws when more than the threshold of icons are unlisted", () => {
    const names = Array.from({ length: MAX_UNLISTED_ICONS + 1 }, (_, index) => `icon-${index}`);
    expect(() => rankLucideIcons(names.slice(1), new Map(), new Map())).not.toThrow();
    expect(() => rankLucideIcons(names, new Map(), new Map())).toThrow(
      `Lucide site is missing ${MAX_UNLISTED_ICONS + 1} canonical icons`,
    );
  });
});
