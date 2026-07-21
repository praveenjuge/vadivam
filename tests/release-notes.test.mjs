import { describe, expect, test } from "bun:test";
import { renderReleaseNotes, summarizeReleaseDiff } from "../scripts/release-notes.mjs";

describe("release notes", () => {
  test("summarizes icon additions, updates, removals, renames, and surfaces", () => {
    const summary = summarizeReleaseDiff([
      "A\ticons/bell.svg",
      "M\ticons/activity.svg",
      "D\ticons/archive.svg",
      "R100\ticons/old-name.svg\ticons/new-name.svg",
      "M\tpackages/vadivam-react/README.md",
      "M\tapps/docs/pages/index.astro",
      "M\tapps/figma-plugin/src/code.ts",
      "M\tscripts/icons.mjs",
    ].join("\n"));

    expect(summary.icons).toEqual({
      added: ["bell", "new-name"],
      changed: ["activity"],
      removed: ["archive", "old-name"],
    });
    const notes = renderReleaseNotes(summary, 242);
    expect(notes).toContain("Ships 242 Vadivam icons");
    expect(notes).toContain("**Added:** `bell`, `new-name`");
    expect(notes).toContain("**Updated:** `activity`");
    expect(notes).toContain("**Removed:** `archive`, `old-name`");
    expect(notes).toContain("[vadivam-react](https://www.npmjs.com/package/vadivam-react)");
    expect(notes).toContain("Documentation");
    expect(notes).toContain("Figma plugin");
    expect(notes).toContain("Release and generation tooling");
  });

  test("describes releases with no icon source changes", () => {
    const summary = summarizeReleaseDiff("M\tpackages/vadivam-vue/README.md\n");
    const notes = renderReleaseNotes(summary, 240);
    expect(notes).toContain("No icon source changes in this release.");
    expect(notes).toContain("[vadivam-vue](https://www.npmjs.com/package/vadivam-vue)");
  });

  test("handles a metadata-only release", () => {
    const notes = renderReleaseNotes(summarizeReleaseDiff(""), 240);
    expect(notes).toContain("No icon source changes in this release.");
    expect(notes).toContain("Package metadata and release state only");
  });
});
