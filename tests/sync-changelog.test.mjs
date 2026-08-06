import { describe, expect, test } from "bun:test";
import path from "node:path";
import { renderChangelogEntry } from "../scripts/sync-changelog.mjs";

describe("sync changelog", () => {
  test("renders Blume changelog frontmatter and body", () => {
    const markdown = renderChangelogEntry({
      tag: "v0.0.41",
      title: "v0.0.41",
      date: "2026-08-05T18:03:19Z",
      body: "Vadivam v0.0.41 ships 505 Vadivam icons.\n\n## Icons\n\n- **Added:** `book`\n",
    });

    expect(markdown).toContain("type: changelog");
    expect(markdown).toContain("version: 0.0.41");
    expect(markdown).toContain("category: Release");
    expect(markdown).toContain("title: 'v0.0.41'");
    expect(markdown).toContain("seo:");
    expect(markdown).toContain("Vadivam v0.0.41 ships 505 Vadivam icons.");
  });

  test("marks prereleases", () => {
    const markdown = renderChangelogEntry({
      tag: "v1.0.0-rc.1",
      title: "v1.0.0-rc.1",
      date: "2026-08-05T18:03:19Z",
      body: "Release candidate.",
      prerelease: true,
    });
    expect(markdown).toContain("category: Prerelease");
    expect(markdown).toContain("version: 1.0.0-rc.1");
  });
});

describe("release notes version label", () => {
  test("accepts an explicit version label separate from the git ref", async () => {
    const proc = Bun.spawn(
      ["bun", "scripts/release-notes.mjs", "v0.0.40", "HEAD", "v0.0.41"],
      { cwd: path.resolve(import.meta.dirname, ".."), stdout: "pipe", stderr: "pipe" }
    );
    const [stdout, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      proc.exited,
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toStartWith("Vadivam v0.0.41 ships");
    expect(stdout).not.toStartWith("Vadivam HEAD ships");
  });
});
