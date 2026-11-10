import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { docsPaths, fromRoot, repoRoot } from "../apps/docs/scripts/paths.mjs";
import { mcpRoute } from "../apps/docs/worker/routes.mjs";
import { notFound } from "../apps/docs/pages/_lib/site.ts";
import { siteUrl } from "../scripts/packages.mjs";
import { mcpToolNames } from "./helpers.mjs";

const clientDir = fromRoot(docsPaths.client);
const serverDir = fromRoot(docsPaths.server);

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
    expect(body).toContain("not found");
    for (const { path: recovery } of notFound.links) {
      expect(body).toContain(`(${siteUrl}${recovery})`);
    }
  });

  test("JSON twin is a valid RFC 9457 problem document", () => {
    const file = path.join(clientDir, "404.json");
    expect(existsSync(file)).toBe(true);
    const body = JSON.parse(readFileSync(file, "utf8"));
    expect(body.status).toBe(404);
    expect(body.title).toBeTruthy();
    expect(body.code).toBe("PAGE_NOT_FOUND");
    expect(body.links.map(({ href }) => href)).toEqual(notFound.links.map(({ path: route }) => `${siteUrl}${route}`));
  });

  test("asset routing sends missing pages to the Worker", () => {
    const config = JSON.parse(readFileSync(path.join(serverDir, "wrangler.json"), "utf8"));
    expect(config.assets.directory).toBe("../client");
    const routes = config.assets.run_worker_first;
    expect(routes).toContain("/*");
    // The exclusion rules must not bypass the Worker for a missing page.
    expect(routes).not.toContain("!/*");
    expect(routes).not.toContain("!/**/*.html");
  });
});

// The root config, which `bun run deploy` and Cloudflare Workers Builds deploy.
describe("built docs Worker", () => {
  let worker;
  let origin;

  beforeAll(async () => {
    const listener = createServer();
    const port = await new Promise((resolve, reject) => {
      listener.once("error", reject);
      listener.listen(0, "127.0.0.1", () => resolve(listener.address().port));
    });
    await new Promise((resolve) => listener.close(resolve));
    origin = `http://127.0.0.1:${port}`;
    worker = spawn(process.execPath, ["x", "wrangler", "dev", "--ip", "127.0.0.1", "--port", String(port)], {
      cwd: repoRoot,
      stdio: "ignore",
    });
    // Wrangler takes a few seconds to start; keep the last error for the report.
    let lastError;
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (worker.exitCode !== null) throw new Error(`Wrangler exited with ${worker.exitCode}`);
      try {
        const response = await fetch(`${origin}/`, { signal: AbortSignal.timeout(500) });
        if (response.ok) return;
        lastError = new Error(`GET / answered ${response.status}`);
      } catch (error) {
        lastError = error;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`Wrangler did not serve the docs within 15s: ${lastError?.message}`);
  }, 30000);

  afterAll(async () => {
    if (!worker) return;
    worker.kill();
    if (worker.exitCode === null && worker.signalCode === null) {
      await new Promise((resolve) => worker.once("exit", resolve));
    }
  });

  test("serves negotiated 404s for missing pages", async () => {
    const url = `${origin}/this-page-does-not-exist`;
    for (const [accept, type, marker] of [
      ["text/markdown", "text/markdown", "# Page not found"],
      ["application/json", "application/problem+json", '"code":"PAGE_NOT_FOUND"'],
    ]) {
      const response = await fetch(url, { headers: { Accept: accept } });
      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toStartWith(type);
      expect(response.headers.get("vary")).toContain("Accept");
      expect((await response.text()).replaceAll(/\s+/g, "")).toContain(marker.replaceAll(/\s+/g, ""));
    }
    const browser = await fetch(url, { headers: { Accept: "text/html" } });
    expect(browser.status).toBe(404);
    expect(browser.headers.get("content-type")).toStartWith("text/html");
  });

  test("serves Markdown to clients that ask for it", async () => {
    const response = await fetch(`${origin}/docs`, { headers: { Accept: "text/markdown" } });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toStartWith("text/markdown");
    expect(response.headers.get("vary")).toContain("Accept");
  });

  test(`answers MCP clients at ${mcpRoute}`, async () => {
    const client = new Client({ name: "vadivam-docs-test", version: "1.0.0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${origin}${mcpRoute}`)));
    try {
      const { tools } = await client.listTools();
      expect(tools.map((tool) => tool.name).sort()).toEqual(mcpToolNames);
    } finally {
      await client.close();
    }
  });
});
