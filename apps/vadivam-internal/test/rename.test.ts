import { describe, expect, test } from "bun:test";
import { suggestRenameIdeas, toKebabName } from "../src/rename";

function ideaNames(value: string): string[] {
  return suggestRenameIdeas(value).map((idea) => idea.name);
}

describe("toKebabName", () => {
  test("normalizes common Figma layer names", () => {
    expect(toKebabName("Icon=ArrowRight")).toBe("arrow-right");
    expect(toKebabName("icons/arrow_right")).toBe("arrow-right");
    expect(toKebabName(" Arrow Right ")).toBe("arrow-right");
    expect(toKebabName("ABCTest")).toBe("abc-test");
  });
});

describe("suggestRenameIdeas", () => {
  test("leaves canonical names alone", () => {
    expect(suggestRenameIdeas("x")).toEqual([]);
    expect(suggestRenameIdeas("arrow-down-0-1")).toEqual([]);
  });

  test("returns only the exact fix when one exists", () => {
    expect(suggestRenameIdeas("ArrowRight")).toEqual([
      { name: "arrow-right", reason: "format" },
    ]);
    expect(suggestRenameIdeas("Arrow Right copy")).toEqual([
      { name: "arrow-right", reason: "format" },
    ]);
    expect(suggestRenameIdeas("search-icon")).toEqual([
      { name: "search", reason: "format" },
    ]);
    expect(suggestRenameIdeas("alert-circle")).toEqual([
      { name: "circle-alert", reason: "deprecated" },
    ]);
    expect(suggestRenameIdeas("AlertCircle")).toEqual([
      { name: "circle-alert", reason: "deprecated" },
    ]);
  });

  test("offers up to three ideas for unknown names", () => {
    expect(ideaNames("plus-user")[0]).toBe("user-plus");
    expect(ideaNames("close")[0]).toBe("x");
    expect(ideaNames("chevron-rigth")[0]).toBe("chevron-right");
    expect(ideaNames("calender")[0]).toBe("calendar");
    expect(ideaNames("mail-plus-thing")).toContain("mail-plus");
    expect(ideaNames("warning")).toContain("triangle-alert");
    for (const value of ["close", "warning", "trash-can", "zzzz"]) {
      expect(suggestRenameIdeas(value).length).toBeLessThanOrEqual(3);
    }
  });
});
