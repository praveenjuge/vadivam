import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "apps", "docs", "dist");
const clientDir = path.join(dist, "client");
const serverDir = path.join(dist, "server");

// Regression: a custom pages/404.astro makes Blume skip generating the
// Markdown and JSON 404 twins, so agents that asked a missing URL for
// text/markdown got the HTML shell. The deploy wrapper only swaps the 404
// shell for dist/client/404.md and dist/client/404.json files that exist.
// Verify the build output, not just source files: the agent-friendly-404
// check needs a Markdown body with recovery links, and the JSON twin is
// an RFC 9457 problem document.
describe("docs 404 twins", () => {
  test("Markdown twin explains the error and links to recovery targets", () => {
    const file = path.join(clientDir, "404.md");
    expect(existsSync(file)).toBe(true);
    const body = readFileSync(file, "utf8");
    expect(body.length).toBeGreaterThanOrEqual(20);
    expect(body).toContain("not found");
    for (const recovery of ["/sitemap.xml", "/llms.txt", "/openapi.json"]) {
      expect(body).toContain(`https://vadivam.praveenjuge.com${recovery}`);
    }
  });

  test("JSON twin is a valid RFC 9457 problem document", () => {
    const file = path.join(clientDir, "404.json");
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

  test("Cloudflare wrapper and asset routing enable negotiated 404s", () => {
    const wrapper = readFileSync(path.join(serverDir, "blume-worker.mjs"), "utf8");
    expect(wrapper).toMatch(/const NOT_FOUND = \{[^}]*"json":true[^}]*"markdown":true[^}]*\}/);
    const config = JSON.parse(readFileSync(path.join(serverDir, "wrangler.json"), "utf8"));
    expect(config.assets.directory).toBe("../client");
    const routes = config.assets.run_worker_first;
    expect(routes).toContain("/*");
    // The exclusion rules must not bypass the Worker for a missing page.
    expect(routes).not.toContain("!/*");
    expect(routes).not.toContain("!/**/*.html");
    expect(wrapper).toContain("application/problem+json");
    expect(wrapper).toContain("text/markdown");
  });
});
