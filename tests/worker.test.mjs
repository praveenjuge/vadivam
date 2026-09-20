import { describe, expect, test } from "bun:test";
import worker, { acceptsMarkdown, appendVary } from "../worker/index.mjs";

const env = (status = 200, headers = { "Content-Type": "text/html" }) => ({
  ASSETS: {
    fetch: async () => new Response(status === 404 ? "not found" : "<h1>Vadivam</h1>", { status, headers }),
  },
});

describe("acceptsMarkdown", () => {
  test("matches the markdown media type exactly", () => {
    expect(acceptsMarkdown("text/markdown")).toBe(true);
    expect(acceptsMarkdown("text/html, text/markdown; q=0.8")).toBe(true);
    expect(acceptsMarkdown("text/markdown; q=0")).toBe(false);
    expect(acceptsMarkdown("application/text/markdown")).toBe(false);
  });
});

describe("appendVary", () => {
  test("preserves existing values and deduplicates case-insensitively", () => {
    const headers = new Headers({ Vary: "Accept-Encoding" });
    appendVary(headers, "Accept");
    appendVary(headers, "accept");
    expect(headers.get("Vary")).toBe("Accept-Encoding, Accept");
  });
});

describe("worker", () => {
  test("negotiates markdown on the homepage", async () => {
    const response = await worker.fetch(
      new Request("https://vadivam.praveenjuge.com/", { headers: { Accept: "text/markdown" } }),
      env(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
    expect(response.headers.get("Vary")).toBe("Accept");
    expect(await response.text()).toContain("# Vadivam Icons");
  });

  test("keeps HTML and marks it as negotiated", async () => {
    const response = await worker.fetch(
      new Request("https://vadivam.praveenjuge.com/", { headers: { Accept: "text/html" } }),
      env(200, { "Content-Type": "text/html", Vary: "Accept-Encoding" }),
    );

    expect(response.headers.get("Content-Type")).toBe("text/html");
    expect(response.headers.get("Vary")).toBe("Accept-Encoding, Accept");
  });

  test("returns a helpful markdown 404", async () => {
    const response = await worker.fetch(
      new Request("https://vadivam.praveenjuge.com/missing", { headers: { Accept: "text/markdown" } }),
      env(404),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
    expect(await response.text()).toContain("llms.txt");
  });
});
