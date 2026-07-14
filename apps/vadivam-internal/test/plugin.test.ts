import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";

interface MockFrame {
  type: "FRAME";
  name: string;
  width: number;
  height: number;
  x: number;
  y: number;
  rotation: number;
  cornerRadius: number;
  children: unknown[];
  fills?: unknown[];
  strokes?: unknown[];
  strokeWeight?: number;
  clipsContent?: boolean;
  layoutGrids?: unknown[];
  exportSettings?: unknown[];
  findAll(): unknown[];
  resize(width: number, height: number): void;
}

interface MockArtwork {
  type: "VECTOR";
  name: string;
  rotation: number;
  cornerRadius: number;
  fills: unknown[];
  strokes: unknown[];
  strokeWeight: number;
  strokeCap: string;
  strokeJoin: string;
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Timed out waiting for plugin message");
}

describe("compiled Figma plugin", () => {
  test("loads the feed, excludes existing icons, and creates canonical frames", async () => {
    const messages: unknown[] = [];
    const validArtwork = (): MockArtwork => ({
      type: "VECTOR",
      name: "Path",
      rotation: 0,
      cornerRadius: 0,
      fills: [],
      strokes: [{ type: "SOLID", visible: true, opacity: 1 }],
      strokeWeight: 2,
      strokeCap: "ROUND",
      strokeJoin: "ROUND",
    });
    const existing = ["x", "check", "chevron-right"].map((name, index) => {
      const artwork = validArtwork();
      if (name === "x") artwork.strokeCap = "NONE";
      if (name === "check") {
        Object.assign(artwork, {
          fills: [{ type: "SOLID", visible: true, opacity: 1 }],
          strokes: [],
          strokeWeight: 1,
          strokeCap: "NONE",
          strokeJoin: "MITER",
        });
      }
      const children = [artwork];
      return {
        type: "FRAME" as const,
        name,
        width: 24,
        height: 24,
        x: index * 40,
        y: 0,
        rotation: 0,
        cornerRadius: 0,
        fills: name === "check" ? [{ type: "SOLID", visible: true, opacity: 1 }] : [],
        layoutGrids: name === "check" ? [{ pattern: "GRID", visible: true }] : [],
        children,
        findAll() {
          return this.children;
        },
        resize() {},
      };
    });
    const currentPage = { name: "Vadivam Icons", children: [...existing], selection: [] };
    const ui: {
      onmessage?: (message: unknown) => Promise<void>;
      postMessage(message: unknown): void;
    } = {
      postMessage(message) {
        messages.push(message);
      },
    };

    const figmaMock = {
      mixed: Symbol("mixed"),
      showUI() {},
      ui,
      root: { children: [currentPage] },
      currentPage,
      async loadAllPagesAsync() {},
      createFrame(): MockFrame {
        const frame: MockFrame = {
          type: "FRAME",
          name: "Frame",
          width: 100,
          height: 100,
          x: 0,
          y: 0,
          rotation: 0,
          cornerRadius: 0,
          children: [],
          findAll() {
            return this.children;
          },
          resize(width, height) {
            this.width = width;
            this.height = height;
          },
        };
        currentPage.children.push(frame as (typeof currentPage.children)[number]);
        return frame;
      },
      viewport: {
        center: { x: 400, y: 300 },
        scrollAndZoomIntoView() {},
      },
    };
    const bundle = readFileSync(new URL("../dist/code.js", import.meta.url), "utf8");

    vm.runInNewContext(bundle, {
      figma: figmaMock,
      __html__: "<html></html>",
      Set,
      Map,
      Promise,
      JSON,
      Math,
      Number,
      Error,
      Intl,
    });

    await waitFor(() =>
      messages.some((message) => (message as { type?: string }).type === "catalog"),
    );
    const catalog = messages.find(
      (message) => (message as { type?: string }).type === "catalog",
    ) as { candidates: Array<{ slug: string }> };
    expect(catalog.candidates.length).toBeGreaterThan(2);
    expect(catalog.candidates.map((icon) => icon.slug)).not.toContain("x");
    const expectedNames = catalog.candidates.slice(0, 2).map((icon) => icon.slug);

    await ui.onmessage?.({ type: "arrange" });
    expect(existing.map((frame) => [frame.name, frame.x, frame.y])).toEqual([
      ["x", 80, 0],
      ["check", 0, 0],
      ["chevron-right", 40, 0],
    ]);

    await ui.onmessage?.({ type: "audit" });
    const audit = messages.find(
      (message) => (message as { type?: string }).type === "audit",
    ) as {
      summary: {
        checked: number;
        passed: number;
        failed: number;
        renamed: number;
        rounded: number;
      };
      issues: Array<{ name: string; violations: string[] }>;
    };
    expect(audit.summary).toEqual({
      checked: 3,
      passed: 2,
      failed: 1,
      renamed: 2,
      rounded: 1,
    });
    expect(existing.map((frame) => frame.children[0]?.name)).toEqual([
      "Vector",
      "Path",
      "Vector",
    ]);
    expect(existing.map((frame) => frame.children[0]?.strokeCap)).toEqual([
      "ROUND",
      "NONE",
      "ROUND",
    ]);
    expect(audit.issues[0]?.name).toBe("check");
    expect(audit.issues[0]?.violations).toContain("Frame must have no background fill");
    expect(audit.issues[0]?.violations).toContain("Frame must have no layout guides");
    expect(audit.issues[0]?.violations).toContain("Artwork must have no fill");
    expect(audit.issues[0]?.violations).toContain("Stroke weight must be 2 px");

    await ui.onmessage?.({ type: "generate", count: 2 });
    const created = currentPage.children.slice(existing.length) as MockFrame[];
    expect(created.map((frame) => frame.name)).toEqual(expectedNames);
    expect(created.map((frame) => [frame.x, frame.y])).toEqual([
      [0, 72],
      [40, 72],
    ]);
    expect(created[0]).toMatchObject({
      width: 24,
      height: 24,
      strokeWeight: 0.5,
      clipsContent: false,
      layoutGrids: [
        {
          pattern: "GRID",
          sectionSize: 2,
          visible: true,
          color: { r: 1, g: 0, b: 0, a: 0.1 },
        },
      ],
      exportSettings: [
        {
          format: "SVG",
          contentsOnly: true,
          svgSimplifyStroke: true,
        },
      ],
    });
  });
});
