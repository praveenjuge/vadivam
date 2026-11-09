import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import rankings from "../../../metadata/lucide-rankings.json";
import { createFigma, runPlugin, type Figma, type FigmaOptions, type MockNode } from "../../figma-shared/test/figma";
import { publishedSprite } from "./published-sprite.mjs";

const metadata = JSON.parse(readFileSync(new URL("../../../metadata/lucide.json", import.meta.url), "utf8"));
const iconCount = readdirSync(new URL("../../../icons/", import.meta.url)).filter((file) => file.endsWith(".svg")).length;
const stroke = [{ type: "SOLID", visible: true, opacity: 1 }];

/** Starts the plugin once `setup` has drawn the file, and waits for its first scan. */
async function start(
  options: FigmaOptions = {},
  setup: (harness: Figma) => void = () => {},
  globals: Record<string, unknown> = {},
): Promise<Figma> {
  const harness = createFigma(options);
  setup(harness);
  const loaded = harness.next("catalog");
  runPlugin(new URL("../dist/code.js", import.meta.url), harness, globals);
  await loaded;
  return harness;
}

const page = (harness: Figma, name?: string) =>
  name ? harness.pages.find((each: MockNode) => each.name === name) : harness.figma.currentPage;

/** A top-level 24×24 icon frame with one stroked vector, as drawn in the source file. */
function iconFrame(harness: Figma, name: string, props: Record<string, unknown> = {}, parent = page(harness)): MockNode {
  const vector = harness.create("VECTOR", { name: "Path", strokes: stroke });
  return harness.create("FRAME", { name, children: [vector], ...props }, parent);
}

const positions = (frames: MockNode[]) => frames.map((frame) => [frame.name, frame.x, frame.y]);
const lastMessage = (harness: Figma) => harness.messages[harness.messages.length - 1];

describe("settings", () => {
  test("load per user, with anything invalid falling back to its default", async () => {
    const harness = await start({ storage: { settings: { columns: 4, batchSize: 2.5, tab: "nope" } } });
    expect(harness.messages[0]).toEqual({ type: "settings", settings: { batchSize: 20, columns: 4, tab: "create" } });
    await harness.send({ type: "set-tab", tab: "audit" });
    await harness.send({ type: "set-columns", columns: 500 });
    expect(harness.store.get("settings")).toEqual({ batchSize: 20, columns: 100, tab: "audit" });
    await harness.send({ type: "set-columns", columns: "40" });
    expect(lastMessage(harness)).toEqual({ type: "error", message: "Columns must be a whole number" });
  });
});

describe("Create", () => {
  test("offers the most popular Lucide icons the file lacks, in any spelling, and creates frames for them", async () => {
    const harness = createFigma({ pages: ["Icons", "Drafts"] });
    const drawn = [rankings.icons[0]!.name, rankings.icons[2]!.name];
    iconFrame(harness, drawn[0]!, { x: 0, y: 0 });
    iconFrame(harness, drawn[1]!.replace(/(^|-)(\w)/g, (_, dash, letter) => letter.toUpperCase()), { x: 40, y: 0 });
    iconFrame(harness, "alert-circle", { x: 0, y: 0 }, page(harness, "Drafts"));
    const loaded = harness.next("catalog");
    runPlugin(new URL("../dist/code.js", import.meta.url), harness);
    const catalog = await loaded;

    const expected = rankings.icons.map((icon) => icon.name).filter((name) => !drawn.includes(name) && name !== "circle-exclamation-point");
    expect(catalog.candidates.map((icon: { name: string }) => icon.name)).toEqual(expected.slice(0, 20));
    expect(catalog.progress).toEqual({ lucideVersion: rankings.lucideVersion, drawn: 3, remaining: rankings.icons.length - 3 });

    await harness.send({ type: "set-count", count: 2 });
    expect(harness.last("catalog")!.candidates).toHaveLength(2);
    await harness.send({ type: "generate", count: 2 });
    const created = page(harness).children.slice(2);
    expect(positions(created)).toEqual([
      [expected[0], 0, 72],
      [expected[1], 40, 72],
    ]);
    expect(created[0]).toMatchObject({
      width: 24,
      height: 24,
      strokeWeight: 0.5,
      clipsContent: false,
      layoutGrids: [{ pattern: "GRID", sectionSize: 2, visible: true, color: { r: 1, g: 0, b: 0, a: 0.1 } }],
      exportSettings: [{ format: "SVG", contentsOnly: true, svgSimplifyStroke: true }],
    });
    expect(harness.last("generated")).toEqual({ type: "generated", names: expected.slice(0, 2) });
    expect(harness.last("catalog")!.progress.drawn).toBe(5);
  });

  test("creates nothing when the page changes while pages load", async () => {
    const harness = createFigma({ pages: ["Icons", "Drafts"] });
    const loaded = harness.next("catalog");
    runPlugin(new URL("../dist/code.js", import.meta.url), harness);
    await loaded;

    harness.figma.loadAllPagesAsync = async () => {
      harness.figma.currentPage = page(harness, "Drafts");
    };
    await harness.send({ type: "generate", count: 2 });
    expect(lastMessage(harness)).toEqual({
      type: "error",
      message: "The page changed while pages loaded; go back to Icons and generate again",
    });
    expect(page(harness, "Icons").children).toHaveLength(0);
    expect(page(harness, "Drafts").children).toHaveLength(0);
  });
});

describe("Arrange", () => {
  test("sorts every 24×24 frame A–Z into the chosen columns and leaves other frames alone", async () => {
    let frames: MockNode[] = [];
    let layout: MockNode;
    const harness = await start({}, (figma) => {
      frames = ["x", "check", "chevron-right", "columns", "made-up"].map((name, index) => iconFrame(figma, name, { x: index * 40, y: 0 }));
      layout = iconFrame(figma, "Grid", { width: 800, height: 600, x: -500, y: -500 });
    });

    await harness.send({ type: "arrange", columns: 2 });
    expect(lastMessage(harness)).toEqual({ type: "arranged", count: 5, columns: 2, rows: 3 });
    expect(positions(frames)).toEqual([
      ["x", 0, 144],
      ["check", 0, 0],
      ["chevron-right", 40, 0],
      ["columns", 0, 72],
      ["made-up", 40, 72],
    ]);
    expect([layout!.x, layout!.y]).toEqual([-500, -500]);
    expect(harness.store.get("settings")).toMatchObject({ columns: 2 });
    expect(harness.commits).toBe(1);
  });
});

describe("Audit", () => {
  async function audit(harness: Figma) {
    await harness.send({ type: "audit" });
    return harness.last("audit")!;
  }
  const violationsOf = (result: MockNode, name: string) =>
    result.issues.find((issue: { name: string }) => issue.name === name)?.violations ?? [];

  test("checks outline frames, renaming stroked layers and rounding their caps", async () => {
    const harness = await start();
    const good = iconFrame(harness, "x");
    good.children[0].strokeCap = "NONE";
    const filled = iconFrame(harness, "check", { fills: stroke, layoutGrids: [{ pattern: "GRID" }] });
    Object.assign(filled.children[0], { fills: stroke, strokes: [], strokeWeight: 1, strokeJoin: "MITER" });
    iconFrame(harness, "columns");
    iconFrame(harness, "ArrowRight");
    iconFrame(harness, "made-up", { width: 32 });

    const result = await audit(harness);
    expect(result.summary).toEqual({ checked: 5, passed: 1, failed: 4, renamed: 4, rounded: 1 });
    expect(good.children[0]).toMatchObject({ name: "Vector", strokeCap: "ROUND" });
    expect(filled.children[0].name).toBe("Path");
    expect(violationsOf(result, "check")).toEqual([
      "Frame must have no background fill",
      "Frame must have no layout guides",
      "Artwork must have no fill",
      "Artwork must use strokes",
      "Stroke weight must be 2 px",
      "Stroke joins must be round",
    ]);
    expect(violationsOf(result, "columns")).toEqual(['Deprecated Lucide name; use "columns-2"']);
    expect(violationsOf(result, "ArrowRight")).toEqual(['Name must be "arrow-right"']);
    expect(violationsOf(result, "made-up")).toEqual(["Name is not in Lucide", "Frame must be 24×24"]);

    await harness.send({ type: "select", id: filled.id });
    expect(page(harness).selection).toEqual([filled]);
  });

  test("checks a Solid page for fills instead of strokes", async () => {
    const harness = await start({ pages: ["Solid icons"] });
    const stroked = iconFrame(harness, "x");
    const filled = iconFrame(harness, "check");
    Object.assign(filled.children[0], { fills: stroke, strokes: [] });

    const result = await audit(harness);
    expect(violationsOf(result, "x")).toEqual(["Solid artwork must have no stroke", "Solid artwork must use fills"]);
    expect(violationsOf(result, "check")).toEqual([]);
    expect(filled.children[0].name).toBe("Vector");
    expect(stroked.children[0].name).toBe("Path");
  });
});

describe("Rename", () => {
  test("suggests current names and renames without creating duplicates", async () => {
    const harness = await start();
    await harness.send({ type: "suggest-names" });
    expect(lastMessage(harness)).toEqual({ type: "error", message: "No icon frames on this page" });

    const x = iconFrame(harness, "x");
    iconFrame(harness, "check");
    const columns = iconFrame(harness, "columns");
    iconFrame(harness, "Grid", { width: 800, height: 600 });
    await harness.send({ type: "suggest-names" });
    expect(lastMessage(harness)).toEqual({
      type: "rename-ideas",
      icons: [{ id: columns.id, name: "columns", ideas: [{ name: "columns-2", reason: "deprecated", taken: false }] }],
      renamed: 0,
    });

    for (const [renames, message] of [
      [[{ id: columns.id, name: "made-up" }], "Rename target is not a current Lucide name"],
      [[{ id: x.id, name: "columns-2" }, { id: columns.id, name: "columns-2" }], "Two icons would get the same name"],
      [[{ id: columns.id, name: "check" }], '"check" is already used in this file'],
    ] as const) {
      await harness.send({ type: "rename", renames });
      expect(lastMessage(harness)).toEqual({ type: "error", message });
    }
    expect(columns.name).toBe("columns");

    await harness.send({ type: "rename", renames: [{ id: columns.id, name: "columns-2" }] });
    expect(columns.name).toBe("columns-2");
    expect(lastMessage(harness)).toEqual({ type: "rename-ideas", icons: [], renamed: 1 });
    expect(harness.commits).toBe(1);
  });
});

describe("pages of each style", () => {
  test("rescan when the current page moves to the other style", async () => {
    const harness = createFigma({ pages: ["Icons", "Solid"] });
    iconFrame(harness, "x");
    iconFrame(harness, "check");
    const loaded = harness.next("catalog");
    runPlugin(new URL("../dist/code.js", import.meta.url), harness);
    expect((await loaded).progress.drawn).toBe(2);

    const switchTo = async (name: string) => {
      const rescanned = harness.next("catalog");
      harness.figma.currentPage = page(harness, name);
      return (await rescanned).progress.drawn;
    };
    expect(await switchTo("Solid")).toBe(0);
    expect(await switchTo("Icons")).toBe(2);
  });
});

describe("Replace", () => {
  test("replaces frame artwork with matching SVG files and adds missing icons", async () => {
    const harness = createFigma({ pages: ["Icons", "Drafts"] });
    iconFrame(harness, "trash", {}, page(harness, "Drafts"));
    const [arrow, check, instance] = [
      iconFrame(harness, "arrow-right", { x: 40, y: 72 }),
      iconFrame(harness, "check", { x: 40, y: 72 }),
      harness.create("INSTANCE", { name: "x", x: 40, y: 72, children: [harness.create("VECTOR", { name: "Path" })] }, page(harness)),
    ];
    const loaded = harness.next("catalog");
    runPlugin(new URL("../dist/code.js", import.meta.url), harness);
    await loaded;

    await harness.send({ type: "replace", files: [] });
    expect(lastMessage(harness)).toEqual({ type: "error", message: "Choose between 1 and 2000 SVG files" });

    const svg = (size: number) => `<svg width="${size}" height="${size}"><path d="M2 2h20"/><path d="M2 12h20"/></svg>`;
    await harness.send({
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
    const added = page(harness).children.find((node: MockNode) => node.name === "bell");
    expect(lastMessage(harness)).toEqual({
      type: "replaced",
      replaced: [{ id: arrow.id, name: "arrow-right" }],
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
    // Matched frames keep their node; only their layers change.
    expect(arrow.children.map((child: MockNode) => child.name)).toEqual(["Vector", "Vector"]);
    expect(check.children.map((child: MockNode) => child.name)).toEqual(["Path"]);
    expect(instance.children.map((child: MockNode) => child.name)).toEqual(["Path"]);
    expect(added).toMatchObject({ width: 24, height: 24 });
    expect(added.children).toHaveLength(2);
    // New frames land in A–Z order on the grid, and a failed add leaves nothing behind.
    expect(page(harness).children).toEqual([arrow, check, instance, added]);
    expect(positions([arrow, added, check, instance])).toEqual([
      ["arrow-right", 40, 72],
      ["bell", 80, 72],
      ["check", 120, 72],
      ["x", 160, 72],
    ]);
    expect(page(harness).selection).toEqual([arrow, added]);
    expect(harness.commits).toBe(1);
  });
});

describe("Library", () => {
  const variants = (set: MockNode) => set.children.map((component: MockNode) => component.name);

  test("creates and updates the documented component library", async () => {
    const harness = await start({ pages: ["Community Library"], viewportCenter: { x: 600, y: 400 } });
    await harness.send({ type: "sync-library" });
    const componentSet = page(harness).selection[0];
    expect(componentSet).toMatchObject({
      type: "COMPONENT_SET",
      name: "Vadivam Icons",
      width: 1944,
      layoutMode: "HORIZONTAL",
      layoutWrap: "WRAP",
      paddingTop: 24,
      itemSpacing: 24,
      counterAxisSpacing: 24,
      fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }],
      documentationLinks: [{ uri: "https://vadivam.praveenjuge.com" }],
      relaunchData: { "sync-library": "Update all icons" },
    });
    expect(componentSet.children).toHaveLength(iconCount * 2);
    expect(componentSet.descriptionMarkdown).toStartWith(`${iconCount} open-source icons on a 24 px grid`);

    const names = readdirSync(new URL("../../../icons/", import.meta.url)).map((file) => file.replace(/\.svg$/, "")).sort();
    expect(variants(componentSet).slice(0, 4)).toEqual([
      `Icon=${names[0]}, Style=Outline`,
      `Icon=${names[0]}, Style=Solid`,
      `Icon=${names[1]}, Style=Outline`,
      `Icon=${names[1]}, Style=Solid`,
    ]);
    const [outline, solid] = componentSet.children;
    const { tags, categories } = metadata.icons[names[0]!];
    const titles = categories.map((id: string) => metadata.categories[id].title);
    expect(outline.descriptionMarkdown).toBe(
      `24 px outline icon from Vadivam.\n\n**Categories:** ${titles.join(", ")}\n\n**Tags:** ${tags.join(", ")}`,
    );
    expect(outline.documentationLinks).toEqual([{ uri: `https://vadivam.praveenjuge.com/icons/${names[0]}` }]);
    expect(JSON.parse(solid.getPluginData("vadivam-internal"))).toEqual({ schema: 1, kind: "icon", name: names[0], style: "solid" });

    // A library from before solid icons: an outline component with no style
    // and no solid variant. Updating keeps the component and adds the variant.
    outline.setPluginData("vadivam-internal", JSON.stringify({ schema: 1, kind: "icon", name: names[0] }));
    outline.name = `Icon=${names[0]}`;
    solid.remove();
    const custom = harness.create("COMPONENT", { name: "Icon=custom, Style=Outline" }, componentSet);
    page(harness).selection = [componentSet];
    await harness.send({ type: "sync-library" });
    expect(componentSet.children[0]).toBe(outline);
    expect(variants(componentSet).slice(0, 2)).toEqual([`Icon=${names[0]}, Style=Outline`, `Icon=${names[0]}, Style=Solid`]);
    expect(componentSet.children[componentSet.children.length - 1]).toBe(custom);
    expect(harness.commits).toBe(2);
    expect(harness.messages.filter((message) => message.type === "library-synced")).toEqual([
      { type: "library-synced", count: iconCount, created: true, added: iconCount * 2, retained: 0 },
      { type: "library-synced", count: iconCount, created: false, added: 1, retained: 1 },
    ]);
  });

  test("updates the library when launched from its relaunch button", async () => {
    const harness = createFigma({ command: "sync-library" });
    const synced = harness.next("library-synced");
    runPlugin(new URL("../dist/code.js", import.meta.url), harness);
    expect(await synced).toMatchObject({ created: true, count: iconCount });
  });
});

describe("New from GitHub or npm", () => {
  test("adds icons that no frame in the file has, leaving existing frames alone", async () => {
    const harness = createFigma({ pages: ["Icons", "Drafts"] });
    // Frames match in any spelling, deprecated names included, and on any page of the style.
    iconFrame(harness, "trash", {}, page(harness, "Drafts"));
    const existing = ["arrow-right", "Check", "alert-circle"].map((name) => iconFrame(harness, name, { x: 40, y: 72 }));

    const published = ["arrow-right", "bell", "check", "circle-chevrons-down", "circle-exclamation-point", "trash"];
    const symbols = (await publishedSprite("outline")).match(/<symbol id="[^"]+" viewBox="0 0 24 24">[\s\S]*?<\/symbol>/g) ?? [];
    const sprite = `<svg xmlns="http://www.w3.org/2000/svg">${symbols
      .filter((symbol) => published.some((name) => symbol.includes(`id="vadivam-${name}"`)))
      .join("")}</svg>`;
    const routes: Record<string, string> = {
      "https://registry.npmjs.org/vadivam/latest": JSON.stringify({ version: "9.9.9" }),
      "https://cdn.jsdelivr.net/npm/vadivam@9.9.9/dist/sprite.svg": sprite,
    };
    const fetched: string[] = [];
    let onFetch = () => {};
    const fetch = async (url: string) => {
      fetched.push(url);
      onFetch();
      const body = routes[url];
      return { ok: body !== undefined, status: body === undefined ? 404 : 200, text: async () => body ?? "" };
    };
    const loaded = harness.next("catalog");
    runPlugin(new URL("../dist/code.js", import.meta.url), harness, { fetch });
    await loaded;

    // The artwork downloaded is for the first page's style, so a page change stops the add.
    onFetch = () => {
      harness.figma.currentPage = page(harness, "Drafts");
    };
    await harness.send({ type: "add-remote", source: "npm" });
    expect(lastMessage(harness)).toEqual({
      type: "error",
      message: "The page changed while icons downloaded; go back to Icons and add them again",
    });
    expect(page(harness, "Drafts").children.map((node: MockNode) => node.name)).toEqual(["trash"]);
    onFetch = () => {};
    harness.figma.currentPage = page(harness, "Icons");

    await harness.send({ type: "check-remote", source: "npm" });
    expect(lastMessage(harness)).toEqual({
      type: "remote-checked",
      source: "npm",
      version: "vadivam@9.9.9",
      missing: ["bell", "circle-chevrons-down"],
    });
    const fetches = fetched.length;
    await harness.send({ type: "add-remote", source: "npm" });
    expect(lastMessage(harness)).toEqual({
      type: "remote-added",
      version: "vadivam@9.9.9",
      added: ["bell", "circle-chevrons-down"],
      failed: [],
    });
    // Adding reuses the checked catalog instead of downloading it again.
    expect(fetched).toHaveLength(fetches);

    for (const frame of existing) expect(frame.children.map((child: MockNode) => child.name)).toEqual(["Path"]);
    const [bell, chevrons] = ["bell", "circle-chevrons-down"].map((name) =>
      page(harness).children.find((node: MockNode) => node.name === name),
    );
    expect(bell.children.length).toBeGreaterThan(0);
    expect(page(harness).children).toEqual([...existing, bell, chevrons]);
    const [arrow, check, alert] = existing;
    expect(positions([alert, arrow, bell, check, chevrons]).map(([, x, y]) => [x, y])).toEqual([
      [40, 72],
      [80, 72],
      [120, 72],
      [160, 72],
      [200, 72],
    ]);
    expect(page(harness).selection).toEqual([bell, chevrons]);
    expect(harness.commits).toBe(1);

    await harness.send({ type: "add-remote", source: "npm" });
    expect(lastMessage(harness)).toMatchObject({ type: "remote-added", added: [], failed: [] });
    expect(harness.commits).toBe(1);
  });
});
