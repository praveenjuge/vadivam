import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
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
    const currentPage = {
      name: "Vadivam Icons",
      children: [...existing],
      selection: [],
      findAll(predicate: (node: (typeof existing)[number]) => boolean) {
        return this.children.filter(predicate);
      },
    };
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

  test("creates and updates the documented canonical component library", async () => {
    const messages: Array<Record<string, unknown>> = [];
    const commits: number[] = [];
    const page: any = {
      type: "PAGE",
      name: "Community Library",
      children: [],
      selection: [],
      findAll(predicate: (node: any) => boolean) {
        const matches: any[] = [];
        const visit = (children: any[]) => {
          for (const child of children) {
            if (predicate(child)) matches.push(child);
            if (child.children) visit(child.children);
          }
        };
        visit(page.children);
        return matches;
      },
    };

    function detach(node: any): void {
      const index = node.parent?.children.indexOf(node) ?? -1;
      if (index >= 0) node.parent.children.splice(index, 1);
    }

    function register(node: any, parent: any = page): any {
      node.parent = parent;
      node.removed = false;
      node.x ??= 0;
      node.y ??= 0;
      node.width ??= 24;
      node.height ??= 24;
      node.rotation ??= 0;
      node._data = new Map<string, string>();
      node.getPluginData = (key: string) => node._data.get(key) ?? "";
      node.setPluginData = (key: string, value: string) => node._data.set(key, value);
      node.setRelaunchData = (value: unknown) => {
        node.relaunchData = value;
      };
      node.resize = (width: number, height: number) => {
        node.width = width;
        node.height = height;
      };
      node.resizeWithoutConstraints = node.resize;
      node.remove = () => {
        detach(node);
        node.removed = true;
      };
      parent.children.push(node);
      return node;
    }

    function vector(): any {
      return {
        type: "VECTOR",
        name: "Vector",
        parent: null,
        remove() {
          detach(this);
        },
      };
    }

    function svgFrame(): any {
      const child = vector();
      const frame = register({
        type: "FRAME",
        name: "SVG",
        children: [child],
        appendChild(next: any) {
          detach(next);
          next.parent = frame;
          frame.children.push(next);
        },
        findAll() {
          return [...frame.children];
        },
      });
      child.parent = frame;
      return frame;
    }

    function componentFromFrame(frame: any): any {
      detach(frame);
      frame.removed = true;
      const component = register({
        type: "COMPONENT",
        name: "Component",
        children: frame.children,
        appendChild(child: any) {
          detach(child);
          child.parent = component;
          component.children.push(child);
        },
        findAll() {
          return [...component.children];
        },
      });
      for (const child of component.children) child.parent = component;
      return component;
    }

    const ui: any = {
      onmessage: undefined,
      postMessage(message: Record<string, unknown>) {
        messages.push(message);
      },
    };
    const figmaMock: any = {
      showUI() {},
      ui,
      root: { children: [page] },
      currentPage: page,
      viewport: {
        center: { x: 600, y: 400 },
        scrollAndZoomIntoView() {},
      },
      async loadAllPagesAsync() {},
      createNodeFromSvg: svgFrame,
      createComponentFromNode: componentFromFrame,
      combineAsVariants(components: any[]) {
        for (const component of components) detach(component);
        const componentSet = register({
          type: "COMPONENT_SET",
          name: "Component Set",
          children: [...components],
          appendChild(child: any) {
            detach(child);
            child.parent = componentSet;
            componentSet.children.push(child);
          },
          insertChild(index: number, child: any) {
            detach(child);
            child.parent = componentSet;
            componentSet.children.splice(index, 0, child);
          },
          findAll(predicate: (node: any) => boolean) {
            return componentSet.children.filter(predicate);
          },
        });
        for (const component of components) component.parent = componentSet;
        return componentSet;
      },
      commitUndo() {
        commits.push(commits.length + 1);
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
      encodeURIComponent,
    });
    await waitFor(() => messages.some((message) => message.type === "catalog"));

    await ui.onmessage({ type: "sync-library" });
    const componentSet = page.selection[0];
    const sourceIconCount = readdirSync(new URL("../../../icons/", import.meta.url))
      .filter((name) => name.endsWith(".svg")).length;
    expect(componentSet).toMatchObject({
      type: "COMPONENT_SET",
      name: "Vadivam Icons",
      width: 984,
      layoutMode: "HORIZONTAL",
      layoutWrap: "WRAP",
      paddingTop: 24,
      paddingRight: 24,
      paddingBottom: 24,
      paddingLeft: 24,
      itemSpacing: 24,
      counterAxisSpacing: 24,
      fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }],
    });
    expect(componentSet.children).toHaveLength(sourceIconCount);
    expect(componentSet.descriptionMarkdown).toContain("## Maintain");
    expect(componentSet.documentationLinks).toEqual([
      { uri: "https://vadivam.praveenjuge.com" },
    ]);

    const firstComponent = componentSet.children[0];
    const firstName = JSON.parse(firstComponent.getPluginData("vadivam-internal")).name;
    expect(firstComponent.name).toBe(`Icon=${firstName}`);
    expect(firstComponent.documentationLinks).toEqual([
      { uri: `https://vadivam.praveenjuge.com/icons/${firstName}` },
    ]);

    page.selection = [componentSet];
    await ui.onmessage({ type: "sync-library" });
    expect(componentSet.children[0]).toBe(firstComponent);
    expect(commits).toHaveLength(2);
    expect(messages.filter((message) => message.type === "library-synced")).toEqual([
      {
        type: "library-synced",
        count: sourceIconCount,
        created: true,
        added: sourceIconCount,
        retained: 0,
      },
      {
        type: "library-synced",
        count: sourceIconCount,
        created: false,
        added: 0,
        retained: 0,
      },
    ]);
  });
});
