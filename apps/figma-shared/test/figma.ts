// A small in-memory Figma for running a built plugin bundle: pages, frames,
// components, instances, and vectors with the properties the plugins read, plus
// the messages, notifications, and undo steps the plugin produces.
import { readFileSync } from "node:fs";
import vm from "node:vm";

export type MockNode = any;
export type Message = Record<string, any> & { type: string };

const CONTAINERS = new Set(["PAGE", "FRAME", "GROUP", "COMPONENT", "COMPONENT_SET", "INSTANCE"]);
const SVG_ELEMENTS = /<(?:path|circle|line|polyline|polygon|rect|ellipse)\b/g;

export interface FigmaOptions {
  /** Page names; the first is the current page. */
  pages?: string[];
  storage?: Record<string, unknown>;
  command?: string;
  viewportCenter?: { x: number; y: number };
}

export function createFigma({ pages: pageNames = ["Page 1"], storage = {}, command = "", viewportCenter = { x: 0, y: 0 } }: FigmaOptions = {}) {
  let nextId = 0;
  const nodes = new Map<string, MockNode>();
  const listeners = new Map<string, Array<() => void>>();
  const messages: Message[] = [];
  const waiters: Array<{ type: string; resolve: (message: Message) => void }> = [];
  const notifications: Array<{ message: string; error: boolean }> = [];
  const store = new Map(Object.entries(storage));
  let commits = 0;

  const emit = (event: string) => {
    for (const listener of listeners.get(event) ?? []) listener();
  };

  function detach(node: MockNode): void {
    const siblings = node.parent?.children;
    const index = siblings?.indexOf(node) ?? -1;
    if (index >= 0) siblings.splice(index, 1);
    node.parent = null;
  }

  function insert(parent: MockNode, index: number, child: MockNode): void {
    detach(child);
    child.parent = parent;
    parent.children.splice(index, 0, child);
  }

  function create(type: string, props: Record<string, unknown> = {}, parent: MockNode | null = null): MockNode {
    const node: MockNode = {
      id: `${++nextId}:0`,
      type,
      name: type === "VECTOR" ? "Vector" : type.charAt(0) + type.slice(1).toLowerCase(),
      parent: null,
      removed: false,
      x: 0,
      y: 0,
      width: 24,
      height: 24,
      rotation: 0,
      opacity: 1,
      blendMode: "PASS_THROUGH",
      visible: true,
      locked: false,
      constraints: { horizontal: "MIN", vertical: "MIN" },
      layoutAlign: "INHERIT",
      layoutGrow: 0,
      layoutPositioning: "AUTO",
      fills: [],
      strokes: [],
      strokeWeight: 0,
      cornerRadius: 0,
      layoutGrids: [],
      exportSettings: [],
      instances: [],
      pluginData: new Map<string, string>(),
      getPluginData: (key: string) => node.pluginData.get(key) ?? "",
      setPluginData: (key: string, value: string) => node.pluginData.set(key, value),
      setRelaunchData: (data: Record<string, string>) => {
        node.relaunchData = data;
      },
      resize: (width: number, height: number) => {
        node.width = width;
        node.height = height;
      },
      resizeWithoutConstraints: (width: number, height: number) => node.resize(width, height),
      remove: () => {
        detach(node);
        node.removed = true;
        nodes.delete(node.id);
      },
      findAll: (predicate: (child: MockNode) => boolean = () => true) => {
        const found: MockNode[] = [];
        const visit = (children: MockNode[]) => {
          for (const child of children) {
            if (predicate(child)) found.push(child);
            if (child.children) visit(child.children);
          }
        };
        visit(node.children ?? []);
        return found;
      },
      appendChild: (child: MockNode) => insert(node, node.children.length, child),
      insertChild: (index: number, child: MockNode) => insert(node, index, child),
      getMainComponentAsync: async () => node.mainComponent ?? null,
      getInstancesAsync: async () => node.instances,
      createInstance: () => instanceOf(node),
    };
    if (CONTAINERS.has(type)) node.children = [];
    if (type === "VECTOR") {
      Object.assign(node, {
        x: 2,
        y: 2,
        width: 20,
        height: 20,
        strokes: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }],
        strokeWeight: 2,
        strokeCap: "ROUND",
        strokeJoin: "ROUND",
      });
    }
    const { children, ...rest } = props as { children?: MockNode[] };
    Object.assign(node, rest);
    for (const child of children ?? []) node.appendChild(child);
    nodes.set(node.id, node);
    if (parent) insert(parent, parent.children.length, node);
    return node;
  }

  function page(name: string): MockNode {
    let selection: MockNode[] = [];
    const node = create("PAGE", { name });
    Object.defineProperty(node, "selection", {
      get: () => selection,
      set: (value: MockNode[]) => {
        selection = value;
        if (figma.currentPage === node) emit("selectionchange");
      },
    });
    return node;
  }

  function instanceOf(main: MockNode): MockNode {
    const instance = create("INSTANCE", { name: main.name, mainComponent: main, children: [create("VECTOR")] }, figma.currentPage);
    main.instances.push(instance);
    return instance;
  }

  const pages = pageNames.map(page);
  let currentPage = pages[0];

  const figma: MockNode = {
    mixed: Symbol("mixed"),
    command,
    root: { type: "DOCUMENT", children: pages },
    get currentPage() {
      return currentPage;
    },
    set currentPage(value: MockNode) {
      currentPage = value;
      emit("currentpagechange");
    },
    viewport: { center: { ...viewportCenter }, scrollAndZoomIntoView() {} },
    clientStorage: {
      getAsync: async (key: string) => store.get(key),
      setAsync: async (key: string, value: unknown) => {
        store.set(key, value);
      },
    },
    ui: {
      onmessage: undefined as ((message: unknown) => Promise<void>) | undefined,
      postMessage(message: Message) {
        messages.push(message);
        for (const waiter of waiters.filter((entry) => entry.type === message.type)) {
          waiters.splice(waiters.indexOf(waiter), 1);
          waiter.resolve(message);
        }
      },
    },
    showUI() {},
    on(event: string, listener: () => void) {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
    },
    notify(message: string, options?: { error?: boolean }) {
      notifications.push({ message, error: options?.error ?? false });
    },
    commitUndo() {
      commits += 1;
    },
    async loadAllPagesAsync() {},
    async getNodeByIdAsync(id: string) {
      return nodes.get(id) ?? null;
    },
    createFrame: () => create("FRAME", { width: 100, height: 100 }, currentPage),
    // One vector per drawing element, sized like the SVG's root.
    createNodeFromSvg(svg: string) {
      const size = Number(/<svg\b[^>]*\swidth="(\d+)"/.exec(svg)?.[1] ?? 24);
      const vectors = Array.from(svg.match(SVG_ELEMENTS) ?? [], () => create("VECTOR"));
      return create("FRAME", { name: "svg", width: size, height: size, children: vectors }, currentPage);
    },
    createComponentFromNode(source: MockNode) {
      const parent = source.parent;
      const component = create("COMPONENT", { x: source.x, y: source.y, width: source.width, height: source.height });
      insert(parent, parent.children.indexOf(source), component);
      for (const child of [...source.children]) component.appendChild(child);
      source.remove();
      return component;
    },
    combineAsVariants(components: MockNode[], parent: MockNode) {
      return create("COMPONENT_SET", { children: components }, parent);
    },
  };

  return {
    figma,
    pages,
    nodes,
    messages,
    notifications,
    store,
    get commits() {
      return commits;
    },
    create,
    instanceOf,
    /** Sends a message from the UI and waits for the plugin to handle it. */
    send: (message: Record<string, unknown>) => figma.ui.onmessage(message),
    /** The next message of this type the plugin posts. */
    next: (type: string) => new Promise<Message>((resolve) => waiters.push({ type, resolve })),
    /** The latest message of this type the plugin posted. */
    last: (type: string) => [...messages].reverse().find((message) => message.type === type),
  };
}

export type Figma = ReturnType<typeof createFigma>;

/** Runs a built main-thread bundle against the mock, as Figma's sandbox would. */
export function runPlugin(bundle: URL, harness: Figma, globals: Record<string, unknown> = {}): void {
  // The test's Error, so errors the mock throws are `instanceof Error` in the bundle, as Figma's are.
  vm.runInNewContext(readFileSync(bundle, "utf8"), { figma: harness.figma, __html__: "<html></html>", Error, ...globals });
}
