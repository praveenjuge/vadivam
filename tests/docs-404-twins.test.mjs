import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "apps", "docs", "public");

// Regression: a custom pages/404.astro makes Blume skip generating the
// Markdown and JSON 404 twins, so agents that asked a missing URL for
// text/markdown got the HTML shell. The deploy wrapper only swaps the 404
// shell for dist/404.md and dist/404.json files that exist, so the project
// ships both twins as static assets. The agent-friendly-404 check needs a
// Markdown body with a recovery link; the JSON twin is the RFC 9457 problem
// document.
describe("docs 404 twins", () => {
  test("Markdown twin explains the error and links to recovery targets", () => {
    const file = path.join(publicDir, "404.md");
    expect(existsSync(file)).toBe(true);
    const body = readFileSync(file, "utf8");
    expect(body.length).toBeGreaterThanOrEqual(20);
    expect(body).toContain("not found");
    for (const recovery of ["/sitemap.xml", "/llms.txt", "/openapi.json"]) {
      expect(body).toContain(`https://vadivam.praveenjuge.com${recovery}`);
    }
  });

  test("JSON twin is a valid RFC 9457 problem document", () => {
    const file = path.join(publicDir, "404.json");
    expect(existsSync(file)).toBe(true);
    const body = JSON.parse(readFileSync(file, "utf8"));
    expect(body.status).toBe(404);
    expect(body.title).toBeTruthy();
    expect(body.code).toBe("PAGE_NOT_FOUND");
    expect(body.links.length).toBeGreaterThan(0);
    for (const link of body.links) {
      expect(link.href).toStartWith("https://vadivam.praveenjuge.com");
    }
  });
});
