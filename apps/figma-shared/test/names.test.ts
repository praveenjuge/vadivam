import { describe, expect, test } from "bun:test";
import { editDistance, iconNames, layerNameKey } from "../names";

const names = iconNames(["arrow-right", "arrow-down-0-1", "book-copy", "letter-s", "letters", "search", "x"], {
  "alert-circle": "circle-alert",
  home: "house",
});

describe("layerNameKey", () => {
  test("turns common layer names into kebab case", () => {
    expect(layerNameKey("Icon=ArrowRight")).toBe("arrow-right");
    expect(layerNameKey("icons/arrow_right")).toBe("arrow-right");
    expect(layerNameKey(" Arrow Right ")).toBe("arrow-right");
    expect(layerNameKey("ABCTest")).toBe("abc-test");
  });
});

describe("iconNames", () => {
  test("finds the current name in any spelling", () => {
    for (const layer of ["arrow-right", "ArrowRight", "arrow_right", "lucide/arrow-right", "LucideArrowRight", "arrow-right icon", "arrow-right copy 2"]) {
      expect(names.current(layer)).toBe("arrow-right");
    }
    expect(names.current("ArrowDown01Icon")).toBe("arrow-down-0-1");
    expect(names.current("made-up")).toBeNull();
  });

  test("prefers an exact name over a stripped one", () => {
    expect(names.current("book copy")).toBe("book-copy");
  });

  test("leaves names that compact to the same letters to their exact spelling", () => {
    expect(names.current("LetterS")).toBe("letter-s");
    expect(names.current("letters")).toBe("letters");
    expect(names.current("Lett-ers")).toBeNull();
  });

  test("keeps deprecated names apart from current ones", () => {
    expect(names.current("home")).toBeNull();
    expect(names.replacement("HomeIcon")).toBe("house");
    expect(names.replacement("AlertCircle")).toBe("circle-alert");
    expect(names.replacement("search")).toBeNull();
  });
});

describe("editDistance", () => {
  test("counts insertions, deletions, substitutions, and adjacent swaps", () => {
    expect(editDistance("search", "search", 2)).toBe(0);
    expect(editDistance("serch", "search", 2)).toBe(1);
    expect(editDistance("saerch", "search", 2)).toBe(1);
    expect(editDistance("calender", "calendar", 2)).toBe(1);
  });

  test("stops at the limit", () => {
    expect(editDistance("abc", "xyz", 1)).toBe(2);
    expect(editDistance("a", "abcdef", 2)).toBe(3);
  });
});
