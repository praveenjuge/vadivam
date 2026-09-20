import { describe, expect, test } from "bun:test";
import worker, { acceptsMarkdown, appendVary } from "../worker/index.mjs";

const env = (status = 200, headers = { "Content-Type": "text/html" }) => ({
  ASSETS: {
    fetch: async () =>
      new Response(status === 404 ? "not found" : "<h1>Vadivam</h1>", {
        status,
        headers,
      }),
  },
});

describe("acceptsMarkdown", () => {
  test("uses exact media types, quality values, and representation preference", () => {
    expect(acceptsMarkdown("text/markdown")).toBe(true);
    expect(acceptsMarkdown("text/html, text/markdown; q=0.8")).toBe(false);
    expect(acceptsMarkdown("text/html; q=0.5, text/markdown; q=0.8")).toBe(
      true,
    );
    expect(acceptsMarkdown("text/markdown; Q=0")).toBe(false);
    expect(acceptsMarkdown("application/text/markdown")).toBe(false);
    expect(acceptsMarkdown("text/html,application/xhtml+xml,*/*;q=0.8")).toBe(
      false,
    );
  });
});

describe("appendVary", () => {
  test("sets, preserves, and deduplicates values", () => {
    const empty = new Headers();
    appendVary(empty, "Accept");
    expect(empty.get("Vary")).toBe("Accept");

    const headers = new Headers({ Vary: "Accept-Encoding" });
    appendVary(headers, "Accept");
    appendVary(headers, "accept");
    expect(headers.get("Vary")).toBe("Accept-Encoding, Accept");

    const wildcard = new Headers({ Vary: "*" });
    appendVary(wildcard, "Accept");
    expect(wildcard.get("Vary")).toBe("*");
  });
});

describe("worker", () => {
  test("negotiates markdown on the homepage", async () => {
    const response = await worker.fetch(
      new Request("https://vadivam.praveenjuge.com/", {
        headers: { Accept: "text/markdown" },
      }),
      env(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/markdown; charset=utf-8",
    );
    expect(response.headers.get("Vary")).toBe("Accept");
    expect(await response.text()).toContain("# Vadivam Icons");
  });

  test("keeps browser and non-homepage responses as HTML", async () => {
    const browserResponse = await worker.fetch(
      new Request("https://vadivam.praveenjuge.com/", {
        headers: { Accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
      }),
      env(200, { "Content-Type": "text/html", Vary: "Accept-Encoding" }),
    );
    const docsResponse = await worker.fetch(
      new Request("https://vadivam.praveenjuge.com/docs", {
        headers: { Accept: "text/markdown" },
      }),
      env(),
    );

    expect(browserResponse.headers.get("Content-Type")).toBe("text/html");
    expect(browserResponse.headers.get("Vary")).toBe("Accept-Encoding, Accept");
    expect(docsResponse.headers.get("Content-Type")).toBe("text/html");
  });

  test("returns a helpful markdown 404 and preserves source metadata", async () => {
    const response = await worker.fetch(
      new Request("https://vadivam.praveenjuge.com/missing", {
        headers: { Accept: "text/markdown" },
      }),
      env(404, {
        "Cache-Control": "public, max-age=60",
        Vary: "Accept-Encoding",
      }),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toBe(
      "text/markdown; charset=utf-8",
    );
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(response.headers.get("Vary")).toBe("Accept-Encoding, Accept");
    expect(await response.text()).toContain("llms.txt");
  });

  test("returns headers without a body for negotiated HEAD requests", async () => {
    for (const [path, status] of [
      ["/", 200],
      ["/missing", 404],
    ]) {
      const response = await worker.fetch(
        new Request(`https://vadivam.praveenjuge.com${path}`, {
          method: "HEAD",
          headers: { Accept: "text/markdown" },
        }),
        env(status),
      );

      expect(response.status).toBe(status);
      expect(response.headers.get("Content-Type")).toBe(
        "text/markdown; charset=utf-8",
      );
      expect(await response.text()).toBe("");
    }
  });
});
