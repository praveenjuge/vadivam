import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";
import { publishedSprite } from "./published-sprite.mjs";

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

function clientStorage(initial: Record<string, unknown> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    async getAsync(key: string) {
      return store.get(key);
    },
    async setAsync(key: string, value: unknown) {
      store.set(key, value);
    },
  };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Timed out waiting for plugin message");
}

describe("compiled Figma plugin", () => {
  test("loads Lucide popularity, excludes existing icons, and creates canonical frames", async () => {
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
    const existing = ["x", "check", "chevron-right", "columns"].map((name, index) => {
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
        id: `1:${index}`,
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
      selection: [] as unknown[],
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

    const storage = clientStorage({ settings: { columns: 4, tab: "nope" } });
    const figmaMock = {
      mixed: Symbol("mixed"),
      showUI() {},
      on() {},
      clientStorage: storage,
      ui,
      root: { children: [currentPage] },
      currentPage,
      async loadAllPagesAsync() {},
      commitUndo() {},
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
    ) as { candidates: Array<{ name: string }> };
    // Stored settings load at startup; invalid values fall back to defaults.
    expect(messages[0]).toEqual({
      type: "settings",
      settings: { batchSize: 20, columns: 4, tab: "create" },
    });
    expect(catalog.candidates.length).toBeGreaterThan(2);
    expect(catalog.candidates.map((icon) => icon.name)).not.toContain("x");
    const expectedNames = catalog.candidates.slice(0, 2).map((icon) => icon.name);

    // A 24×24 frame with an unknown name is arranged alongside the rest, while a
    // large layout frame that happens to share a Lucide name is left alone.
    const unknown = { ...existing[0]!, id: "1:9", name: "made-up", x: 400, y: 400 };
    const layout = { ...existing[0]!, id: "1:10", name: "Grid", width: 800, height: 600, x: -500, y: -500 };
    currentPage.children.push(unknown, layout);
    await ui.onmessage?.({ type: "arrange", columns: 2 });
    expect(messages[messages.length - 1]).toEqual({
      type: "arranged",
      count: 5,
      columns: 2,
      rows: 3,
    });
    expect(
      [...existing, unknown].map((frame) => [frame.name, frame.x, frame.y]),
    ).toEqual([
      ["x", 0, 144],
      ["check", 0, 0],
      ["chevron-right", 40, 0],
      ["columns", 0, 72],
      ["made-up", 40, 72],
    ]);
    expect(storage.store.get("settings")).toMatchObject({ columns: 2 });

    // Without columns, Arrange uses the saved setting.
    await ui.onmessage?.({ type: "set-columns", columns: 40 });
    await ui.onmessage?.({ type: "arrange" });
    expect(messages[messages.length - 1]).toEqual({
      type: "arranged",
      count: 5,
      columns: 40,
      rows: 1,
    });
    expect(
      [...existing, unknown].map((frame) => [frame.name, frame.x, frame.y]),
    ).toEqual([
      ["x", 160, 0],
      ["check", 0, 0],
      ["chevron-right", 40, 0],
      ["columns", 80, 0],
      ["made-up", 120, 0],
    ]);
    expect([layout.x, layout.y]).toEqual([-500, -500]);
    currentPage.children.splice(currentPage.children.indexOf(unknown), 2);

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
      issues: Array<{ id: string; name: string; violations: string[] }>;
    };
    expect(audit.summary).toEqual({
      checked: 4,
      passed: 2,
      failed: 2,
      renamed: 3,
      rounded: 1,
    });
    expect(existing.map((frame) => frame.children[0]?.name)).toEqual([
      "Vector",
      "Path",
      "Vector",
      "Vector",
    ]);
    expect(existing.map((frame) => frame.children[0]?.strokeCap)).toEqual([
      "ROUND",
      "NONE",
      "ROUND",
      "ROUND",
    ]);
    expect(audit.issues[0]?.name).toBe("check");
    expect(audit.issues[0]?.violations).toContain("Frame must have no background fill");
    expect(audit.issues[0]?.violations).toContain("Frame must have no layout guides");
    expect(audit.issues[0]?.violations).toContain("Artwork must have no fill");
    expect(audit.issues[0]?.violations).toContain("Stroke weight must be 2 px");
    expect(audit.issues[1]).toEqual({
      id: "1:3",
      name: "columns",
      violations: ['Deprecated Lucide name; use "columns-2"'],
    });

    // Audit issues can be selected from the list.
    await ui.onmessage?.({ type: "select", id: "1:1" });
    expect(currentPage.selection).toEqual([existing[1]]);

    // On a Solid page, filled artwork passes and stroked artwork fails.
    currentPage.name = "Solid";
    await ui.onmessage?.({ type: "audit" });
    const solidAudit = [...messages].reverse().find(
      (message) => (message as { type?: string }).type === "audit",
    ) as { issues: Array<{ name: string; violations: string[] }> };
    const solidViolations = (name: string) => solidAudit.issues.find((issue) => issue.name === name)?.violations ?? [];
    expect(solidViolations("x")).toContain("Solid artwork must have no stroke");
    expect(solidViolations("x")).toContain("Solid artwork must use fills");
    expect(solidViolations("check")).not.toContain("Solid artwork must use fills");
    expect(solidViolations("check")).not.toContain("Stroke weight must be 2 px");
    currentPage.name = "Vadivam Icons";

    const savedChildren = currentPage.children.splice(0);
    await ui.onmessage?.({ type: "suggest-names" });
    expect(messages[messages.length - 1]).toEqual({
      type: "error",
      message: "No icon frames on this page",
    });
    currentPage.children.push(...savedChildren);

    // Suggest also ignores the large layout frame.
    currentPage.children.push(layout);
    await ui.onmessage?.({ type: "suggest-names" });
    expect(messages[messages.length - 1]).toEqual({
      type: "rename-ideas",
      icons: [
        {
          id: "1:3",
          name: "columns",
          ideas: [{ name: "columns-2", reason: "deprecated", taken: false }],
        },
      ],
      renamed: 0,
    });
    currentPage.children.splice(currentPage.children.indexOf(layout), 1);

    await ui.onmessage?.({ type: "rename", renames: [{ id: "1:3", name: "made-up" }] });
    expect(messages[messages.length - 1]).toEqual({
      type: "error",
      message: "Rename target is not a current Lucide name",
    });
    expect(existing[3]!.name).toBe("columns");

    await ui.onmessage?.({
      type: "rename",
      renames: [
        { id: "1:0", name: "columns-2" },
        { id: "1:3", name: "columns-2" },
      ],
    });
    expect(messages[messages.length - 1]).toEqual({
      type: "error",
      message: "Two icons would get the same name",
    });
    expect(existing.map((frame) => frame.name)).toEqual([
      "x",
      "check",
      "chevron-right",
      "columns",
    ]);

    await ui.onmessage?.({ type: "rename", renames: [{ id: "1:3", name: "check" }] });
    expect(messages[messages.length - 1]).toEqual({
      type: "error",
      message: '"check" is already used in this file',
    });
    expect(existing[3]!.name).toBe("columns");

    await ui.onmessage?.({ type: "rename", renames: [{ id: "1:3", name: "columns-2" }] });
    expect(existing[3]!.name).toBe("columns-2");
    expect(messages[messages.length - 1]).toEqual({
      type: "rename-ideas",
      icons: [],
      renamed: 1,
    });

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

  test("replaces frame artwork with matching SVG files and adds missing icons", async () => {
    const messages: Array<Record<string, unknown>> = [];
    const commits: number[] = [];
    const page: any = {
      name: "Icons",
      children: [],
      selection: [],
      findAll(predicate: (node: any) => boolean) {
        return page.children.filter(predicate);
      },
    };

    function detach(node: any): void {
      const index = node.parent?.children.indexOf(node) ?? -1;
      if (index >= 0) node.parent.children.splice(index, 1);
    }

    function vector(name: string, parent: any): any {
      const node: any = { type: "VECTOR", name, parent, remove: () => detach(node) };
      parent.children.push(node);
      return node;
    }

    function container(type: string, id: string, name: string, size = 24, parent = page): any {
      const node: any = {
        type,
        id,
        name,
        width: size,
        height: size,
        x: 40,
        y: 72,
        children: [],
        parent,
        appendChild(child: any) {
          detach(child);
          child.parent = node;
          node.children.push(child);
        },
        remove() {
          detach(node);
          node.removed = true;
        },
      };
      parent.children.push(node);
      return node;
    }

    const otherPage: any = { name: "Drafts", children: [] };
    container("FRAME", "2:1", "trash", 24, otherPage);
    const arrow = container("FRAME", "1:1", "arrow-right");
    const check = container("FRAME", "1:2", "check");
    const instance = container("INSTANCE", "1:3", "x");
    for (const frame of [arrow, check, instance]) vector("Old", frame);

    const ui: any = {
      postMessage(message: Record<string, unknown>) {
        messages.push(message);
      },
    };
    const figmaMock: any = {
      showUI() {},
      on() {},
      clientStorage: clientStorage(),
      ui,
      root: { children: [page, otherPage] },
      currentPage: page,
      viewport: { center: { x: 0, y: 0 }, scrollAndZoomIntoView() {} },
      async loadAllPagesAsync() {},
      commitUndo() {
        commits.push(commits.length + 1);
      },
      createFrame() {
        const frame = container("FRAME", `new:${page.children.length}`, "Frame", 100);
        frame.resize = (width: number, height: number) => {
          frame.width = width;
          frame.height = height;
        };
        return frame;
      },
      // The mock reads the size from the SVG's width attribute.
      createNodeFromSvg(svg: string) {
        const size = Number(/width="(\d+)"/.exec(svg)?.[1] ?? 24);
        const frame = container("FRAME", `svg:${page.children.length}`, "SVG", size);
        vector("New", frame);
        vector("New", frame);
        return frame;
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
    await waitFor(() => messages.some((message) => message.type === "catalog"));

    await ui.onmessage({ type: "replace", files: [] });
    expect(messages[messages.length - 1]).toEqual({
      type: "error",
      message: "Choose between 1 and 2000 SVG files",
    });

    const svg = (size: number) => `<svg width="${size}" height="${size}"></svg>`;
    await ui.onmessage({
      type: "replace",
      files: [
        { name: "ArrowRight.svg", svg: svg(24) },
        { name: "arrow_right.svg", svg: svg(24) },
        { name: "check.svg", svg: svg(48) },
        { name: "x.svg", svg: svg(24) },
        { name: "Bell.svg", svg: svg(24) },
        { name: "bell.svg", svg: svg(24) },
        { name: "big-new.svg", svg: svg(48) },
        { name: "trash.svg", svg: svg(24) },
      ],
    });
    const added = page.children.find((node: any) => node.name === "bell");
    expect(messages[messages.length - 1]).toEqual({
      type: "replaced",
      replaced: [{ id: "1:1", name: "arrow-right" }],
      added: [{ id: added.id, name: "bell" }],
      skipped: [
        { file: "arrow_right.svg", reason: "Another file has the same icon name" },
        { file: "check.svg", reason: "SVG must be 24×24" },
        { file: "x.svg", reason: '"x" is an instance; detach it first' },
        { file: "bell.svg", reason: "Another file has the same icon name" },
        { file: "big-new.svg", reason: "SVG must be 24×24" },
        { file: "trash.svg", reason: '"trash" is on the "Drafts" page' },
      ],
    });
    // Matched frames keep their node; only their layers change, and the SVG frames are cleaned up.
    expect(arrow.children.map((child: any) => child.name)).toEqual(["New", "New"]);
    expect(check.children.map((child: any) => child.name)).toEqual(["Old"]);
    expect(instance.children.map((child: any) => child.name)).toEqual(["Old"]);
    expect(added.children.map((child: any) => child.name)).toEqual(["New", "New"]);
    expect([added.width, added.height]).toEqual([24, 24]);
    // New frames land in A–Z order on the grid, and a failed add leaves nothing behind.
    expect(page.children).toEqual([arrow, check, instance, added]);
    const order = [arrow, added, check, instance].map((node: any) => [node.x, node.y]);
    expect(order).toEqual([[40, 72], [80, 72], [120, 72], [160, 72]]);
    expect(page.selection).toEqual([arrow, added]);
    expect(commits).toHaveLength(1);
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
      on() {},
      clientStorage: clientStorage(),
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
      width: 1944,
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
    expect(componentSet.children).toHaveLength(sourceIconCount * 2);
    expect(componentSet.descriptionMarkdown).toBe(
      `${sourceIconCount} open-source icons on a 24 px grid, each in an outline and a solid style. Pick an icon with the **Icon** property and a style with **Style**, then change the color as needed.`,
    );
    expect(componentSet.documentationLinks).toEqual([
      { uri: "https://vadivam.praveenjuge.com" },
    ]);

    const firstComponent = componentSet.children[0];
    const firstName = JSON.parse(firstComponent.getPluginData("vadivam-internal")).name;
    expect(firstComponent.name).toBe(`Icon=${firstName}, Style=Outline`);
    const firstSolid = componentSet.children[1];
    expect(firstSolid.name).toBe(`Icon=${firstName}, Style=Solid`);
    expect(JSON.parse(firstSolid.getPluginData("vadivam-internal"))).toMatchObject({ name: firstName, style: "solid" });
    expect(firstSolid.descriptionMarkdown).toStartWith("24 px solid icon from Vadivam.");
    expect(firstComponent.documentationLinks).toEqual([
      { uri: `https://vadivam.praveenjuge.com/icons/${firstName}` },
    ]);
    const metadata = JSON.parse(
      readFileSync(new URL("../../../metadata/lucide.json", import.meta.url), "utf8"),
    );
    const { tags, categories } = metadata.icons[firstName];
    const categoryTitles = categories.map((id: string) => metadata.categories[id].title);
    expect(firstComponent.descriptionMarkdown).toBe(
      `24 px outline icon from Vadivam.\n\n**Categories:** ${categoryTitles.join(", ")}\n\n**Tags:** ${tags.join(", ")}`,
    );

    // A library from before solid icons: an outline component with no style,
    // and no solid variant. Updating keeps the component and adds the variant.
    firstComponent.setPluginData("vadivam-internal", JSON.stringify({ schema: 1, kind: "icon", name: firstName }));
    firstComponent.name = `Icon=${firstName}`;
    firstSolid.remove();
    page.selection = [componentSet];
    await ui.onmessage({ type: "sync-library" });
    expect(componentSet.children[0]).toBe(firstComponent);
    expect(firstComponent.name).toBe(`Icon=${firstName}, Style=Outline`);
    expect(componentSet.children[1].name).toBe(`Icon=${firstName}, Style=Solid`);
    expect(componentSet.children).toHaveLength(sourceIconCount * 2);
    expect(commits).toHaveLength(2);
    expect(messages.filter((message) => message.type === "library-synced")).toEqual([
      {
        type: "library-synced",
        count: sourceIconCount,
        created: true,
        added: sourceIconCount * 2,
        retained: 0,
      },
      {
        type: "library-synced",
        count: sourceIconCount,
        created: false,
        added: 1,
        retained: 0,
      },
    ]);
  });

  test("adds icons from npm that no frame in the file has, leaving existing frames alone", async () => {
    const messages: Array<Record<string, unknown>> = [];
    const commits: number[] = [];
    const page: any = {
      name: "Icons",
      children: [],
      selection: [],
      findAll(predicate: (node: any) => boolean) {
        return page.children.filter(predicate);
      },
    };

    function detach(node: any): void {
      const index = node.parent?.children.indexOf(node) ?? -1;
      if (index >= 0) node.parent.children.splice(index, 1);
    }

    function vector(name: string, parent: any): any {
      const node: any = { type: "VECTOR", name, parent, remove: () => detach(node) };
      parent.children.push(node);
      return node;
    }

    function container(type: string, id: string, name: string, parent = page): any {
      const node: any = {
        type,
        id,
        name,
        width: 24,
        height: 24,
        x: 40,
        y: 72,
        children: [],
        parent,
        appendChild(child: any) {
          detach(child);
          child.parent = node;
          node.children.push(child);
        },
        remove() {
          detach(node);
          node.removed = true;
        },
      };
      parent.children.push(node);
      return node;
    }

    // Frames match by any spelling of their name, deprecated aliases included,
    // and icons on other pages count too.
    const otherPage: any = { name: "Drafts", children: [] };
    container("FRAME", "2:1", "trash", otherPage);
    const arrow = container("FRAME", "1:1", "arrow-right");
    const check = container("FRAME", "1:2", "Check");
    const alert = container("FRAME", "1:3", "alert-circle");
    for (const frame of [arrow, check, alert]) vector("Edited", frame);

    const ui: any = {
      postMessage(message: Record<string, unknown>) {
        messages.push(message);
      },
    };
    const figmaMock: any = {
      showUI() {},
      on() {},
      clientStorage: clientStorage(),
      ui,
      root: { children: [page, otherPage] },
      currentPage: page,
      viewport: { center: { x: 0, y: 0 }, scrollAndZoomIntoView() {} },
      async loadAllPagesAsync() {},
      commitUndo() {
        commits.push(commits.length + 1);
      },
      createFrame() {
        const frame = container("FRAME", `new:${page.children.length}`, "Frame");
        frame.resize = (width: number, height: number) => {
          frame.width = width;
          frame.height = height;
        };
        return frame;
      },
      createNodeFromSvg() {
        const frame = container("FRAME", `svg:${page.children.length}`, "SVG");
        vector("New", frame);
        return frame;
      },
    };

    // npm latest serves the real published symbols for a handful of icons.
    const published = ["arrow-right", "bell", "check", "circle-alert", "circle-chevrons-down", "trash"];
    const symbols = (await publishedSprite()).match(/<symbol id="[^"]+" viewBox="0 0 24 24">[\s\S]*?<\/symbol>/g) ?? [];
    const sprite = `<svg xmlns="http://www.w3.org/2000/svg">${symbols
      .filter((symbol) => published.some((name) => symbol.includes(`id="vadivam-${name}"`)))
      .join("")}</svg>`;
    const fetched: string[] = [];
    const routes: Record<string, string> = {
      "https://registry.npmjs.org/vadivam/latest": JSON.stringify({ version: "9.9.9" }),
      "https://cdn.jsdelivr.net/npm/vadivam@9.9.9/dist/sprite.svg": sprite,
    };
    const fetch = async (url: string) => {
      fetched.push(url);
      const body = routes[url];
      return { ok: body !== undefined, status: body === undefined ? 404 : 200, text: async () => body ?? "" };
    };

    const bundle = readFileSync(new URL("../dist/code.js", import.meta.url), "utf8");
    vm.runInNewContext(bundle, {
      figma: figmaMock,
      __html__: "<html></html>",
      fetch,
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

    const last = () => messages[messages.length - 1];
    await ui.onmessage({ type: "check-remote", source: "npm" });
    expect(last()).toEqual({
      type: "remote-checked",
      source: "npm",
      version: "vadivam@9.9.9",
      total: published.length,
      missing: ["bell", "circle-chevrons-down"],
    });
    const fetchesAfterCheck = fetched.length;
    await ui.onmessage({ type: "add-remote", source: "npm" });
    expect(last()).toEqual({
      type: "remote-added",
      source: "npm",
      version: "vadivam@9.9.9",
      added: ["bell", "circle-chevrons-down"],
      failed: [],
    });
    // Adding reuses the checked catalog instead of downloading it again.
    expect(fetched).toHaveLength(fetchesAfterCheck);

    // Existing frames keep their artwork; new frames get the downloaded artwork
    // and land in A–Z order on the grid.
    for (const frame of [arrow, check, alert]) {
      expect(frame.children.map((child: any) => child.name)).toEqual(["Edited"]);
    }
    const bell = page.children.find((node: any) => node.name === "bell");
    const chevrons = page.children.find((node: any) => node.name === "circle-chevrons-down");
    expect(bell.children.map((child: any) => child.name)).toEqual(["New"]);
    expect(page.children).toEqual([arrow, check, alert, bell, chevrons]);
    const order = [alert, arrow, bell, check, chevrons].map((node: any) => [node.x, node.y]);
    expect(order).toEqual([[40, 72], [80, 72], [120, 72], [160, 72], [200, 72]]);
    expect(page.selection).toEqual([bell, chevrons]);
    expect(commits).toHaveLength(1);

    // A second add finds nothing to do and leaves the undo history alone.
    await ui.onmessage({ type: "add-remote", source: "npm" });
    expect(last()).toMatchObject({ type: "remote-added", added: [], failed: [] });
    expect(commits).toHaveLength(1);
  });
});
