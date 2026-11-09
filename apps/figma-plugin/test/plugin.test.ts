import { describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { readFileSync, readdirSync, utimesSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createFigma, runPlugin, type Figma, type MockNode } from "../../figma-shared/test/figma";

const pluginRoot = fileURLToPath(new URL("..", import.meta.url));
const red = [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }];
const metadata = JSON.parse(readFileSync(new URL("../../../metadata/lucide.json", import.meta.url), "utf8"));

function start(): Figma {
  const harness = createFigma({ viewportCenter: { x: 200, y: 100 } });
  runPlugin(new URL("../dist/code.js", import.meta.url), harness);
  return harness;
}

const page = (harness: Figma) => harness.figma.currentPage;
const components = (harness: Figma) => page(harness).children.filter((node: MockNode) => node.type === "COMPONENT");
const lastNotice = (harness: Figma) => harness.notifications[harness.notifications.length - 1];
const pluginData = (node: MockNode) => JSON.parse(node.getPluginData("vadivam"));

async function choose(harness: Figma, iconName: string, style = "outline"): Promise<MockNode> {
  await harness.send({ type: "choose", iconName, style });
  return page(harness).selection[0];
}

// A layer as Lucide's Figma plugin or library leaves it: a square of red,
// 1.5px strokes named after the icon.
function lucideLayer(harness: Figma, type: string, name: string, size = 24): MockNode {
  const vector = harness.create("VECTOR", { strokes: red, strokeWeight: 1.5 });
  return harness.create(type, { name, width: size, height: size, children: [vector] }, page(harness));
}

function container(harness: Figma, name: string, children: MockNode[]): MockNode {
  return harness.create("FRAME", { name, width: 320, height: 200, children }, page(harness));
}

async function select(harness: Figma, nodes: MockNode[]) {
  const scanned = harness.next("lucide-selection");
  page(harness).selection = nodes;
  return (await scanned).count;
}

describe("inserting and replacing icons", () => {
  test("inserts a described, tagged component at the viewport center", async () => {
    const harness = start();
    expect(harness.last("ready")).toBeDefined();

    const component = await choose(harness, "search");
    expect(component).toMatchObject({
      type: "COMPONENT",
      name: "search",
      width: 24,
      height: 24,
      x: 188,
      y: 88,
      relaunchData: { replace: "Replace search" },
      documentationLinks: [{ uri: "https://vadivam.praveenjuge.com/icons/search" }],
      exportSettings: [{ format: "SVG", contentsOnly: true }],
    });
    expect(pluginData(component)).toEqual({ schema: 1, iconName: "search" });
    const { tags, categories } = metadata.icons.search;
    const titles = categories.map((id: string) => metadata.categories[id].title);
    expect(component.descriptionMarkdown).toBe(
      `24 px outline icon from Vadivam.\n\n**Categories:** ${titles.join(", ")}\n\n**Tags:** ${tags.join(", ")}`,
    );
    expect(harness.commits).toBe(1);
    expect(lastNotice(harness)).toEqual({ message: "Inserted search", error: false });
    expect(harness.last("complete")).toBeDefined();
  });

  test("lines up icons inserted one after another", async () => {
    const harness = start();
    const first = await choose(harness, "search");
    const second = await choose(harness, "heart");
    expect(second).not.toBe(first);
    expect(second).toMatchObject({ name: "heart", x: 228, y: 88 });
    expect(harness.figma.viewport.center).toEqual({ x: 240, y: 100 });
    expect(first.name).toBe("search");
    expect(components(harness)).toHaveLength(2);
  });

  test("redraws a selected component in place, keeping its size and position", async () => {
    const harness = start();
    const component = await choose(harness, "search");
    await choose(harness, "star");
    Object.assign(component, { x: 30, y: 40 });
    component.resizeWithoutConstraints(32, 32);
    page(harness).selection = [component];

    expect(await choose(harness, "heart")).toBe(component);
    expect(component).toMatchObject({ name: "heart", x: 30, y: 40, width: 32, height: 32 });
    expect(pluginData(component).iconName).toBe("heart");
    expect(lastNotice(harness)?.message).toBe("Replaced with heart");
  });

  test("asks before redrawing a component that has instances", async () => {
    const harness = start();
    const component = await choose(harness, "search");
    harness.instanceOf(component);
    // Choosing while the icon just inserted is selected places the next one beside it, so reselect it.
    page(harness).selection = [];
    page(harness).selection = [component];
    await choose(harness, "star");
    const confirmation = harness.last("confirm-replace")!;
    expect(confirmation).toMatchObject({ iconName: "star", instanceCount: 1 });
    expect(component.name).toBe("search");

    await harness.send({ type: "confirm-replace", requestId: confirmation.requestId, accepted: false });
    expect(component.name).toBe("search");
    await harness.send({ type: "confirm-replace", requestId: confirmation.requestId, accepted: true });
    expect(lastNotice(harness)).toEqual({ message: "This replacement request has expired", error: true });

    await choose(harness, "star");
    const commits = harness.commits;
    await harness.send({ type: "confirm-replace", requestId: harness.last("confirm-replace")!.requestId, accepted: true });
    expect(component.name).toBe("star");
    expect(harness.commits).toBe(commits + 1);
  });

  test("replaces only a selected instance, where it sits", async () => {
    const harness = start();
    const component = await choose(harness, "search");
    const instance = harness.instanceOf(component);
    Object.assign(instance, { x: 80, y: 90 });
    page(harness).selection = [instance];

    const replacement = await choose(harness, "moon");
    expect(replacement).not.toBe(component);
    expect(replacement).toMatchObject({ type: "COMPONENT", name: "moon", x: 80, y: 90 });
    expect(component.name).toBe("search");
    expect(instance.removed).toBe(true);
    expect(lastNotice(harness)?.message).toBe("Replaced this use with moon");
  });

  test("inserts solid icons and moves an icon's color between stroke and fill", async () => {
    const harness = start();
    const solid = await choose(harness, "search", "solid");
    expect(solid).toMatchObject({ name: "search-solid", relaunchData: { replace: "Replace search-solid" } });
    expect(pluginData(solid)).toEqual({ schema: 1, iconName: "search", style: "solid" });
    expect(solid.descriptionMarkdown).toStartWith("24 px solid icon from Vadivam.");

    const outline = await choose(harness, "heart");
    for (const child of outline.children) child.strokes = red;
    await choose(harness, "star");
    page(harness).selection = [outline];
    await choose(harness, "heart", "solid");
    expect(outline.name).toBe("heart-solid");
    for (const child of outline.children) expect(child.fills).toEqual(red);
  });

  test("rejects unknown icons and styles without touching the document", async () => {
    const harness = start();
    await harness.send({ type: "choose", iconName: "not-an-icon", style: "outline" });
    expect(lastNotice(harness)).toEqual({ message: "Unknown Vadivam icon", error: true });
    await harness.send({ type: "choose", iconName: "search", style: "bold" });
    expect(lastNotice(harness)).toEqual({ message: "Unsupported plugin action", error: true });
    expect(harness.last("error")).toBeDefined();
    expect(page(harness).children).toHaveLength(0);
    expect(harness.commits).toBe(0);
  });
});

describe("swapping Lucide icons", () => {
  test("finds Lucide icons in the selection and swaps them for Vadivam components", async () => {
    const harness = start();
    const vadivam = await choose(harness, "search");
    const arrow = lucideLayer(harness, "FRAME", "lucide/ArrowRight", 16);
    const secondArrow = lucideLayer(harness, "FRAME", "arrow-right", 20);
    const home = lucideLayer(harness, "GROUP", "home");
    const digits = lucideLayer(harness, "FRAME", "ArrowDown01Icon");
    const star = lucideLayer(harness, "COMPONENT", "star");
    const starUse = harness.instanceOf(star);
    const bell = harness.instanceOf({ id: "remote-bell", name: "Bell", instances: [], getPluginData: () => "" });
    const label = harness.create("FRAME", { name: "search", children: [harness.create("TEXT")] }, page(harness));
    const notSquare = lucideLayer(harness, "FRAME", "heart");
    notSquare.width = 40;
    // A square button with a filled background and an icon inside is UI, not an icon.
    const button = lucideLayer(harness, "FRAME", "search");
    button.insertChild(0, harness.create("RECTANGLE", { fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 1 } }] }));
    Object.assign(arrow, { x: 12, layoutGrow: 1 });
    const card = container(harness, "Card", [arrow, secondArrow, home, digits, star, starUse, bell, label, notSquare, button, vadivam]);

    expect(await select(harness, [card])).toBe(6);
    const commits = harness.commits;
    await harness.send({ type: "swap-lucide" });
    expect(harness.commits).toBe(commits + 1);
    expect(lastNotice(harness)?.message).toBe("Swapped 6 Lucide icons for Vadivam");

    const [arrowComponent, arrowInstance, house, arrowDown, starComponent, starInstance, bellComponent, ...rest] = card.children;
    expect(arrowComponent).toMatchObject({ type: "COMPONENT", name: "arrow-right", width: 16, height: 16, x: 12, layoutGrow: 1 });
    for (const child of arrowComponent.children) {
      expect(child).toMatchObject({ strokes: red, strokeWeight: 1.5, constraints: { horizontal: "SCALE", vertical: "SCALE" } });
    }
    expect(await arrowInstance.getMainComponentAsync()).toBe(arrowComponent);
    expect(arrowInstance).toMatchObject({ type: "INSTANCE", width: 20, height: 20 });
    expect(house).toMatchObject({ type: "COMPONENT", name: "house" });
    expect(arrowDown).toMatchObject({ type: "COMPONENT", name: "arrow-down-0-1" });
    expect(starComponent).toBe(star);
    expect(pluginData(star).iconName).toBe("star");
    expect(star.children.every((child: MockNode) => child.strokeWeight === 1.5)).toBe(true);
    expect(starInstance).toBe(starUse);
    expect(bellComponent).toMatchObject({ type: "COMPONENT", name: "bell" });
    expect(rest).toEqual([label, notSquare, button, vadivam]);
    expect(arrow.removed).toBe(true);
    expect(page(harness).selection).toHaveLength(6);

    expect(await select(harness, [card])).toBe(0);
    await harness.send({ type: "swap-lucide" });
    expect(lastNotice(harness)).toEqual({ message: "No Lucide icons in the selection", error: true });
  });

  test("removes the new component when a swap cannot be placed", async () => {
    const harness = start();
    const arrow = lucideLayer(harness, "FRAME", "arrow-right");
    const locked = container(harness, "Locked", [arrow]);
    locked.insertChild = () => {
      throw new Error("This layer is locked");
    };
    expect(await select(harness, [locked])).toBe(1);

    await harness.send({ type: "swap-lucide" });
    expect(lastNotice(harness)).toEqual({ message: "This layer is locked", error: true });
    expect(components(harness)).toHaveLength(0);
    expect(locked.children).toEqual([arrow]);
  });

  test("swaps the layers it can and reports the ones it can't", async () => {
    const harness = start();
    const blocked = lucideLayer(harness, "FRAME", "arrow-right");
    const locked = container(harness, "Locked", [blocked]);
    locked.insertChild = () => {
      throw new Error("This layer is locked");
    };
    const open = container(harness, "Open", [lucideLayer(harness, "FRAME", "bell")]);
    expect(await select(harness, [locked, open])).toBe(2);

    await harness.send({ type: "swap-lucide" });
    expect(lastNotice(harness)?.message).toBe(
      "Swapped 1 Lucide icon for Vadivam; couldn't swap arrow-right: This layer is locked",
    );
    expect(harness.commits).toBe(1);
    expect(locked.children).toEqual([blocked]);
    expect(open.children[0]).toMatchObject({ type: "COMPONENT", name: "bell" });
  });
});

describe("package", () => {
  test("inserts every icon in the repository in both styles", async () => {
    const harness = start();
    const names = readdirSync(new URL("../../../icons/", import.meta.url))
      .filter((file) => file.endsWith(".svg"))
      .map((file) => file.slice(0, -".svg".length));
    for (const name of names) {
      for (const style of ["outline", "solid"]) await choose(harness, name, style);
    }
    expect(harness.notifications.filter((notice) => notice.error)).toEqual([]);
    expect(components(harness)).toHaveLength(names.length * 2);
  });

  test("keeps the registered plugin ID the README documents", () => {
    const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
    const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
    expect(readme).toContain(`registered plugin ID \`${manifest.id}\``);
  });

  test("watch mode rebuilds ui.html when the stylesheet changes", async () => {
    const child = spawn(process.execPath, ["scripts/build.mjs", "--watch"], { cwd: pluginRoot, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    // Resolves once `pattern` has appeared `times` times in the build's output.
    const seen = (pattern: string, times: number) =>
      new Promise<void>((resolve, reject) => {
        const check = () => {
          if (output.split(pattern).length - 1 >= times) resolve();
        };
        child.stdout.on("data", check);
        child.stderr.on("data", check);
        child.once("exit", (code) => reject(new Error(`Watch build exited with code ${code}:\n${output}`)));
        check();
      });
    child.stdout.on("data", (chunk: Buffer) => (output += chunk));
    child.stderr.on("data", (chunk: Buffer) => (output += chunk));
    try {
      await seen("watching for changes", 1);
      await seen("wrote dist/ui.html", 1);
      const now = new Date();
      utimesSync(new URL("../src/ui.css", import.meta.url), now, now);
      await seen("wrote dist/ui.html", 2);
    } finally {
      child.kill("SIGTERM");
    }
    expect(output).not.toContain("Could not resolve");
  }, 30_000);
});
