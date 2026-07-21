import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";

type NodeRecord = ReturnType<typeof createHarness>["nodes"] extends Map<string, infer T>
  ? T
  : never;

function createHarness() {
  let nextId = 0;
  const messages: Array<Record<string, unknown>> = [];
  const nodes = new Map<string, any>();
  const commits: number[] = [];
  const notifications: Array<{ message: string; options?: { error?: boolean } }> = [];
  const listeners = new Map<string, Array<() => void>>();
  let selection: any[] = [];

  const page: any = {
    type: "PAGE",
    name: "Page 1",
    children: [],
    get selection() {
      return selection;
    },
    set selection(value: any[]) {
      selection = value;
      for (const listener of listeners.get("selectionchange") ?? []) listener();
    },
    insertChild(index: number, child: any) {
      child.parent?.children.splice(child.parent.children.indexOf(child), 1);
      child.parent = page;
      page.children.splice(index, 0, child);
    },
  };

  function register(node: any) {
    node.id = `node-${++nextId}`;
    node.parent = page;
    node.x ??= 0;
    node.y ??= 0;
    node.width ??= 24;
    node.height ??= 24;
    node.rotation ??= 0;
    node.opacity ??= 1;
    node.blendMode ??= "PASS_THROUGH";
    node.visible ??= true;
    node.locked ??= false;
    node.constraints ??= { horizontal: "MIN", vertical: "MIN" };
    node.layoutAlign ??= "INHERIT";
    node.layoutGrow ??= 0;
    node.layoutPositioning ??= "AUTO";
    node._data ??= new Map();
    node.setPluginData ??= (key: string, value: string) => node._data.set(key, value);
    node.getPluginData ??= (key: string) => node._data.get(key) ?? "";
    node.setRelaunchData ??= (value: unknown) => {
      node.relaunchData = value;
    };
    node.resize ??= (width: number, height: number) => {
      node.width = width;
      node.height = height;
    };
    node.resizeWithoutConstraints ??= node.resize;
    node.remove ??= () => {
      const index = node.parent?.children.indexOf(node) ?? -1;
      if (index >= 0) node.parent.children.splice(index, 1);
      nodes.delete(node.id);
    };
    nodes.set(node.id, node);
    page.children.push(node);
    return node;
  }

  function vector() {
    const node: any = {
      type: "VECTOR",
      name: "Vector",
      x: 2,
      y: 2,
      width: 20,
      height: 20,
      fills: [],
      strokes: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }],
      strokeWeight: 2,
      resize(width: number, height: number) {
        this.width = width;
        this.height = height;
      },
      remove() {
        const index = this.parent.children.indexOf(this);
        if (index >= 0) this.parent.children.splice(index, 1);
      },
    };
    return node;
  }

  function frame() {
    const child = vector();
    const node: any = register({
      type: "FRAME",
      children: [child],
      appendChild(nextChild: any) {
        nextChild.parent?.children.splice(nextChild.parent.children.indexOf(nextChild), 1);
        nextChild.parent = node;
        node.children.push(nextChild);
      },
      findAll() {
        return [...node.children];
      },
    });
    child.parent = node;
    return node;
  }

  function componentFromFrame(source: any) {
    const sourceIndex = page.children.indexOf(source);
    if (sourceIndex >= 0) page.children.splice(sourceIndex, 1);
    nodes.delete(source.id);
    const component: any = register({
      type: "COMPONENT",
      children: source.children,
      instances: [],
      exportSettings: [],
      appendChild(child: any) {
        child.parent?.children.splice(child.parent.children.indexOf(child), 1);
        child.parent = component;
        component.children.push(child);
      },
      findAll() {
        return [...component.children];
      },
      async getInstancesAsync() {
        return component.instances;
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
    mixed: Symbol("mixed"),
    showUI() {},
    ui,
    currentPage: page,
    viewport: { center: { x: 200, y: 100 } },
    on(event: string, listener: () => void) {
      const registered = listeners.get(event) ?? [];
      registered.push(listener);
      listeners.set(event, registered);
    },
    createNodeFromSvg: frame,
    createComponentFromNode: componentFromFrame,
    commitUndo() {
      commits.push(commits.length + 1);
    },
    notify(message: string, options?: { error?: boolean }) {
      notifications.push({ message, options });
    },
    async getNodeByIdAsync(id: string) {
      return nodes.get(id) ?? null;
    },
  };

  function instanceOf(main: any) {
    const child = vector();
    const instance: any = register({
      type: "INSTANCE",
      children: [child],
      async getMainComponentAsync() {
        return main;
      },
      findAll() {
        return [...instance.children];
      },
    });
    child.parent = instance;
    main.instances.push(instance);
    return instance;
  }

  return { figmaMock, ui, page, nodes, messages, commits, notifications, instanceOf };
}

async function runPlugin(harness: ReturnType<typeof createHarness>) {
  const bundle = readFileSync(new URL("../dist/code.js", import.meta.url), "utf8");
  vm.runInNewContext(bundle, {
    figma: harness.figmaMock,
    __html__: "<html></html>",
    Set,
    Map,
    Promise,
    JSON,
    Math,
    Number,
    Error,
    Date,
  });
  await Promise.resolve();
}

function latest(harness: ReturnType<typeof createHarness>, type: string) {
  return [...harness.messages].reverse().find((message) => message.type === type);
}

describe("compiled Figma plugin", () => {
  test("inserts, replaces, confirms propagation, and isolates selected instances", async () => {
    const harness = createHarness();
    await runPlugin(harness);
    const catalog = latest(harness, "catalog") as { count: number };
    const sourceIconCount = readdirSync(new URL("../../../icons/", import.meta.url))
      .filter((name) => name.endsWith(".svg")).length;
    expect(catalog.count).toBe(sourceIconCount);

    await harness.ui.onmessage({ type: "choose", iconName: "search" });
    const component = harness.page.selection[0];
    expect(component).toMatchObject({
      type: "COMPONENT",
      name: "search",
      width: 24,
      height: 24,
      x: 188,
      y: 88,
      relaunchData: { replace: "Replace search" },
    });
    expect(JSON.parse(component.getPluginData("vadivam"))).toEqual({
      schema: 1,
      iconName: "search",
    });
    expect(harness.commits).toHaveLength(1);
    expect(harness.notifications[harness.notifications.length - 1]?.message).toBe("Inserted search");

    await harness.ui.onmessage({ type: "choose", iconName: "heart" });
    const secondComponent = harness.page.selection[0];
    expect(secondComponent).not.toBe(component);
    expect(secondComponent).toMatchObject({
      type: "COMPONENT",
      name: "heart",
      x: 228,
      y: 88,
    });
    expect(harness.figmaMock.viewport.center).toEqual({ x: 240, y: 100 });
    expect(component.name).toBe("search");
    expect(harness.page.children.filter((node: NodeRecord) => node.type === "COMPONENT")).toHaveLength(2);
    expect(harness.commits).toHaveLength(2);

    component.x = 30;
    component.y = 40;
    component.resizeWithoutConstraints(32, 32);
    harness.page.selection = [component];
    await harness.ui.onmessage({ type: "choose", iconName: "heart" });
    expect(harness.page.selection[0]).toBe(component);
    expect(component).toMatchObject({ name: "heart", x: 30, y: 40, width: 32, height: 32 });
    expect(harness.commits).toHaveLength(3);

    const instance = harness.instanceOf(component);
    instance.x = 80;
    instance.y = 90;
    harness.page.selection = [component];
    await harness.ui.onmessage({ type: "choose", iconName: "star" });
    const confirmation = latest(harness, "confirm-replace") as {
      requestId: string;
      instanceCount: number;
    };
    expect(confirmation.instanceCount).toBe(1);
    expect(component.name).toBe("heart");
    await harness.ui.onmessage({
      type: "confirm-replace",
      requestId: confirmation.requestId,
      accepted: true,
    });
    expect(component.name).toBe("star");
    expect(harness.commits).toHaveLength(4);

    harness.page.selection = [instance];
    await harness.ui.onmessage({ type: "choose", iconName: "moon" });
    const replacement = harness.page.selection[0];
    expect(replacement).not.toBe(component);
    expect(replacement).toMatchObject({ type: "COMPONENT", name: "moon", x: 80, y: 90 });
    expect(component.name).toBe("star");
    expect(harness.nodes.has(instance.id)).toBe(false);
    expect(harness.commits).toHaveLength(5);
  });

  test("uses the single registered Figma plugin ID", () => {
    const source = readFileSync(new URL("../manifest.json", import.meta.url), "utf8");
    expect(source.match(/"id"\s*:/g)).toHaveLength(1);
    expect(JSON.parse(source).id).toBe("1661323620355050204");
  });

  test("rejects unknown icon names without modifying the document", async () => {
    const harness = createHarness();
    await runPlugin(harness);
    await harness.ui.onmessage({ type: "choose", iconName: "not-an-icon" });
    expect(latest(harness, "error")?.message).toBe("Unknown Vadivam icon");
    expect(harness.notifications[harness.notifications.length - 1]).toEqual({
      message: "Unknown Vadivam icon",
      options: { error: true },
    });
    expect(harness.page.children).toHaveLength(0);
    expect(harness.commits).toHaveLength(0);
  });
});
