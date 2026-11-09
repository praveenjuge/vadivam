import { describe, expect, test } from "bun:test";
import { isReleasablePath } from "../scripts/release-changes.mjs";

describe("automatic release change detection", () => {
  test.each([
    "apps/docs/pages/index.astro",
    "apps/docs/public/frameworks/react.svg",
    "apps/docs/scripts/complete-sitemap.mjs",
    "scripts/solid-draft.mjs",
    "scripts/icon-report.mjs",
    "metadata/solid-hints.json",
    "tests/seo.test.mjs",
    ".github/workflows/icons-optimize.yml",
    "README.md",
    "package.json",
    "bun.lock",
  ])("does not release npm packages for %s", (path) => {
    expect(isReleasablePath(path)).toBe(false);
  });

  test.each([
    "icons/activity.svg",
    "icons-solid/activity.svg",
    "packages/vadivam/package.json",
    "packages/vadivam-react/README.md",
    "apps/figma-plugin/src/code.ts",
    "apps/figma-shared/names.ts",
    "scripts/generators/react-native.mjs",
    "scripts/font-codepoints.json",
    "scripts/icons.mjs",
    "scripts/icon-geometry.mjs",
    "scripts/icon-styles.mjs",
    "scripts/packages.mjs",
    "scripts/snippets.mjs",
    "metadata/lucide.json",
    "metadata/lucide-aliases.json",
    "metadata/lucide-rankings.json",
    "packages/vadivam-mcp/src/server.js",
    "packages/vadivam-mcp/server.json",
    "apps/docs/skills/vadivam-icons/SKILL.md",
  ])("releases when package-producing input %s changes", (path) => {
    expect(isReleasablePath(path)).toBe(true);
  });
});
