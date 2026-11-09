import { describe, expect, test } from "bun:test";
import { suggestRenameIdeas } from "../src/rename";

function ideaNames(value: string): string[] {
  return suggestRenameIdeas(value).map((idea) => idea.name);
}

describe("suggestRenameIdeas", () => {
  test("leaves canonical names alone", () => {
    expect(suggestRenameIdeas("x")).toEqual([]);
    expect(suggestRenameIdeas("arrow-down-0-1")).toEqual([]);
  });

  test("restores the separators PascalCase drops around digits and letters", () => {
    expect(suggestRenameIdeas("ArrowDown01")).toEqual([{ name: "arrow-down-0-1", reason: "format" }]);
    expect(suggestRenameIdeas("ArrowDownAZ")).toEqual([{ name: "arrow-down-a-z", reason: "format" }]);
    expect(suggestRenameIdeas("ArrowDownZA")).toEqual([{ name: "arrow-down-z-a", reason: "format" }]);
  });

  test("points deprecated Lucide names at their replacement in any spelling", () => {
    expect(suggestRenameIdeas("columns")).toEqual([{ name: "columns-2", reason: "deprecated" }]);
    expect(suggestRenameIdeas("Columns")).toEqual([{ name: "columns-2", reason: "deprecated" }]);
    expect(suggestRenameIdeas("CircleEuroSign")).toEqual([{ name: "circle-euro", reason: "deprecated" }]);
  });

  test("returns only the exact fix when one exists", () => {
    expect(suggestRenameIdeas("ArrowRight")).toEqual([
      { name: "arrow-right", reason: "format" },
    ]);
    expect(suggestRenameIdeas("Arrow Right copy")).toEqual([
      { name: "arrow-right", reason: "format" },
    ]);
    expect(suggestRenameIdeas("x ")).toEqual([{ name: "x", reason: "format" }]);
    expect(suggestRenameIdeas("search-icon")).toEqual([
      { name: "search", reason: "format" },
    ]);
    expect(suggestRenameIdeas("alert-circle")).toEqual([
      { name: "circle-exclamation-point", reason: "deprecated" },
    ]);
    expect(suggestRenameIdeas("AlertCircle")).toEqual([
      { name: "circle-exclamation-point", reason: "deprecated" },
    ]);
  });

  test("offers up to three ideas for unknown names", () => {
    expect(ideaNames("plus-user")[0]).toBe("user-plus");
    expect(ideaNames("close")[0]).toBe("x");
    expect(ideaNames("chevron-rigth")[0]).toBe("chevron-right");
    expect(ideaNames("calender")[0]).toBe("calendar");
    expect(ideaNames("mail-plus-thing")).toContain("mail-plus");
    expect(ideaNames("exclamation")).toContain("badge-exclamation-point");
    for (const value of ["close", "warning", "trash-can", "zzzz"]) {
      expect(suggestRenameIdeas(value).length).toBeLessThanOrEqual(3);
    }
  });
});
