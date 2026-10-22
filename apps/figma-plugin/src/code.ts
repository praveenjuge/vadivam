import icons, { lucideAliases, svgRoot } from "vadivam:catalog";
import type { PluginToUiMessage, UiToPluginMessage } from "./protocol";

const UI_WIDTH = 320;
const UI_HEIGHT = 480;
const INSERTION_GAP = 16;
const PLUGIN_DATA_KEY = "vadivam";
const PLUGIN_DATA_SCHEMA = 1;
const DOCUMENTATION_URL = "https://vadivam.praveenjuge.com";
const catalog = new Map(icons.map((icon) => [icon.name, icon]));
// Selections are scanned on every change, so stop after this many layers.
const MAX_SCAN_NODES = 5000;
const SHAPE_TYPES = new Set(["VECTOR", "LINE", "ELLIPSE", "RECTANGLE", "POLYGON", "STAR", "BOOLEAN_OPERATION"]);
const ICON_LAYER_TYPES = new Set(["FRAME", "GROUP", "COMPONENT", "INSTANCE"]);
const compactName = (name: string) => name.replace(/[^a-z0-9]/g, "");
// Current names win over deprecated ones that compact to the same letters.
const iconsByCompactName = new Map([
  ...Object.entries(lucideAliases).map(([alias, name]) => [compactName(alias), name] as const),
  ...icons.map((icon) => [compactName(icon.name), icon.name] as const),
]);

type CatalogIcon = (typeof icons)[number];

interface PendingReplacement {
  requestId: string;
  targetId: string;
  iconName: string;
}

let pendingReplacement: PendingReplacement | null = null;
let lastInsertedComponentId: string | null = null;

figma.showUI(__html__, {
  width: UI_WIDTH,
  height: UI_HEIGHT,
  title: "Vadivam Icons",
  themeColors: true,
});

function post(message: PluginToUiMessage): void {
  figma.ui.postMessage(message);
}

function complete(message: string): void {
  figma.notify(message);
  post({ type: "complete", message });
}

function reportError(error: unknown): void {
  const message = messageFromError(error);
  figma.notify(message, { error: true });
  post({ type: "error", message });
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected plugin error";
}

function iconMetadata(name: string): string {
  return JSON.stringify({ schema: PLUGIN_DATA_SCHEMA, iconName: name });
}

function taggedIconName(node: BaseNode & PluginDataMixin): string | null {
  const value = node.getPluginData(PLUGIN_DATA_KEY);
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return parsed.schema === PLUGIN_DATA_SCHEMA &&
      typeof parsed.iconName === "string" &&
      catalog.has(parsed.iconName)
      ? parsed.iconName
      : null;
  } catch {
    return null;
  }
}

// Category titles and tags are plain words, so Figma's asset search finds the component by them.
function iconDescription(icon: CatalogIcon): string {
  return [
    "24 px outline icon from Vadivam.",
    icon.categories.length > 0 ? `**Categories:** ${icon.categories.join(", ")}` : "",
    icon.tags.length > 0 ? `**Tags:** ${icon.tags.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function tagComponent(component: ComponentNode, icon: CatalogIcon): void {
  const name = icon.name;
  component.name = name;
  component.setPluginData(PLUGIN_DATA_KEY, iconMetadata(name));
  component.setRelaunchData({ replace: `Replace ${name}` });
  component.descriptionMarkdown = iconDescription(icon);
  component.documentationLinks = [
    { uri: `${DOCUMENTATION_URL}/icons/${encodeURIComponent(name)}` },
  ];
  component.exportSettings = [
    {
      format: "SVG",
      suffix: "",
      contentsOnly: true,
      svgOutlineText: true,
      svgIdAttribute: false,
      svgSimplifyStroke: true,
      colorProfile: "DOCUMENT",
    },
  ];
}

function iconSvg(icon: CatalogIcon): string {
  return `${svgRoot}${icon.body}</svg>`;
}

function createComponent(icon: CatalogIcon): ComponentNode {
  const frame = figma.createNodeFromSvg(iconSvg(icon));
  try {
    const component = figma.createComponentFromNode(frame);
    tagComponent(component, icon);
    return component;
  } catch (error) {
    if (!frame.removed) frame.remove();
    throw error;
  }
}

function geometryNodes(node: ChildrenMixin): Array<SceneNode & GeometryMixin> {
  return node
    .findAll(() => true)
    .filter(
      (child): child is SceneNode & GeometryMixin =>
        "strokes" in child && "fills" in child,
    );
}

function clonePaints(paints: readonly Paint[]): Paint[] {
  return JSON.parse(JSON.stringify(paints)) as Paint[];
}

function uniformStrokePaint(node: ChildrenMixin): Paint[] | null {
  const strokes = geometryNodes(node)
    .map((child) => child.strokes as readonly Paint[] | typeof figma.mixed)
    .filter(
      (paints): paints is readonly Paint[] =>
        paints !== figma.mixed && paints.length > 0,
    );
  if (strokes.length === 0) return null;
  const serialized = JSON.stringify(strokes[0]);
  return strokes.every((paints) => JSON.stringify(paints) === serialized)
    ? clonePaints(strokes[0] as readonly Paint[])
    : null;
}

function applyStrokePaint(node: ChildrenMixin, paints: readonly Paint[] | null): void {
  if (!paints) return;
  for (const child of geometryNodes(node)) child.strokes = clonePaints(paints);
}

function scaleChildren(
  children: readonly SceneNode[],
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): void {
  const scaleX = targetWidth / sourceWidth;
  const scaleY = targetHeight / sourceHeight;
  for (const child of children) {
    if (!("resize" in child)) continue;
    child.x *= scaleX;
    child.y *= scaleY;
    child.resize(
      Math.max(0.01, child.width * scaleX),
      Math.max(0.01, child.height * scaleY),
    );
  }
}

function resizeIcon(component: ComponentNode, width: number, height: number): void {
  const sourceWidth = component.width;
  const sourceHeight = component.height;
  scaleChildren(component.children, sourceWidth, sourceHeight, width, height);
  component.resizeWithoutConstraints(width, height);
}

function copyLayoutContext(
  source: SceneNode,
  target: ComponentNode | InstanceNode,
): void {
  target.x = source.x;
  target.y = source.y;
  target.visible = source.visible;
  target.locked = source.locked;
  // Groups carry no constraints, so copy each property the source has.
  if ("rotation" in source) target.rotation = source.rotation;
  if ("opacity" in source) target.opacity = source.opacity;
  if ("blendMode" in source) target.blendMode = source.blendMode;
  if ("constraints" in source) target.constraints = source.constraints;
  if ("layoutAlign" in source) target.layoutAlign = source.layoutAlign;
  if ("layoutGrow" in source) target.layoutGrow = source.layoutGrow;
  if ("layoutPositioning" in source) target.layoutPositioning = source.layoutPositioning;
}

function placeComponent(
  component: ComponentNode,
  previousInsertion: ComponentNode | null,
): void {
  if (previousInsertion) {
    component.x = Math.round(
      previousInsertion.x + previousInsertion.width + INSERTION_GAP,
    );
    component.y = Math.round(previousInsertion.y);
  } else {
    component.x = Math.round(figma.viewport.center.x - component.width / 2);
    component.y = Math.round(figma.viewport.center.y - component.height / 2);
  }
  figma.currentPage.selection = [component];
  figma.viewport.center = {
    x: component.x + component.width / 2,
    y: component.y + component.height / 2,
  };
}

figma.on("selectionchange", () => {
  if (!lastInsertedComponentId) return;
  const selection = figma.currentPage.selection;
  if (selection.length !== 1 || selection[0]?.id !== lastInsertedComponentId) {
    lastInsertedComponentId = null;
  }
});

function replaceComponentGlyph(component: ComponentNode, icon: CatalogIcon): void {
  const paint = uniformStrokePaint(component);
  const oldChildren = [...component.children];
  const source = figma.createNodeFromSvg(iconSvg(icon));
  const sourceWidth = source.width;
  const sourceHeight = source.height;
  const newChildren = [...source.children];
  scaleChildren(newChildren, sourceWidth, sourceHeight, component.width, component.height);
  applyStrokePaint(source, paint);
  const moved: SceneNode[] = [];
  try {
    for (const child of newChildren) {
      component.appendChild(child);
      moved.push(child);
    }
  } catch (error) {
    for (const child of moved) source.appendChild(child);
    source.remove();
    throw error;
  }
  for (const child of oldChildren) child.remove();
  source.remove();
  tagComponent(component, icon);
  figma.currentPage.selection = [component];
}

function replaceInstance(instance: InstanceNode, icon: CatalogIcon): void {
  const parent = instance.parent;
  if (!parent || !("insertChild" in parent)) {
    throw new Error("This icon cannot be replaced in its current parent");
  }
  const index = parent.children.indexOf(instance);
  const paint = uniformStrokePaint(instance);
  const component = createComponent(icon);
  try {
    resizeIcon(component, instance.width, instance.height);
    applyStrokePaint(component, paint);
    parent.insertChild(Math.max(0, index), component);
    copyLayoutContext(instance, component);
    instance.remove();
    figma.currentPage.selection = [component];
  } catch (error) {
    if (!component.removed) component.remove();
    throw error;
  }
}

async function taggedInstance(node: SceneNode): Promise<InstanceNode | null> {
  if (node.type !== "INSTANCE") return null;
  const main = await node.getMainComponentAsync();
  return main && taggedIconName(main) ? node : null;
}

function uniformStrokeWeight(node: ChildrenMixin): number | null {
  const weights = geometryNodes(node)
    .filter((child) => (child.strokes as readonly Paint[] | typeof figma.mixed) !== figma.mixed && child.strokes.length > 0)
    .map((child) => ("strokeWeight" in child ? child.strokeWeight : figma.mixed));
  const first = weights[0];
  return typeof first === "number" && weights.every((weight) => weight === first) ? first : null;
}

function applyStrokeWeight(node: ChildrenMixin, weight: number | null): void {
  if (weight === null) return;
  for (const child of geometryNodes(node)) {
    if ("strokeWeight" in child) child.strokeWeight = weight;
  }
}

/**
 * The Vadivam icon a layer name refers to: `arrow-right`, `ArrowRight`,
 * `lucide/arrow-right`, `LucideArrowRight`, `arrow-right icon`, or a
 * deprecated Lucide name such as `home`.
 */
function lucideIconName(layerName: string): string | null {
  const segment = (layerName.split("/").pop() ?? "")
    .trim()
    .replace(/^lucide[\s_-]+/i, "")
    .replace(/^Lucide(?=[A-Z])/, "");
  for (const base of [segment, segment.replace(/[\s_-]*icon$/i, "")]) {
    const name = base.replace(/([a-z])([A-Z])/g, "$1-$2").replace(/[\s_]+/g, "-").toLowerCase();
    if (!name) continue;
    if (catalog.has(name)) return name;
    if (lucideAliases[name]) return lucideAliases[name];
    // PascalCase drops the dashes around digits: ArrowDown01 is arrow-down-0-1.
    const match = iconsByCompactName.get(compactName(name));
    if (match) return match;
  }
  return null;
}

// A square layer drawn only with shapes, like an icon pasted from Lucide or
// placed from its Figma library, as opposed to a frame of UI named "search".
function isOutlineIcon(node: SceneNode & ChildrenMixin): boolean {
  if (Math.abs(node.width - node.height) > 0.5 || node.width < 8 || node.width > 256) return false;
  let shapes = 0;
  const stack: SceneNode[] = [...node.children];
  while (stack.length > 0) {
    const child = stack.pop()!;
    if (SHAPE_TYPES.has(child.type)) shapes += 1;
    else if ((child.type === "GROUP" || child.type === "FRAME") && "children" in child) stack.push(...child.children);
    else return false;
  }
  return shapes > 0;
}

function insideInstance(node: BaseNode): boolean {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === "INSTANCE") return true;
  }
  return false;
}

async function isVadivamIcon(node: SceneNode): Promise<boolean> {
  if (node.type === "COMPONENT") return taggedIconName(node) !== null;
  if (node.type !== "INSTANCE") return false;
  const main = await node.getMainComponentAsync();
  return Boolean(main && taggedIconName(main));
}

interface LucideMatch {
  node: SceneNode & ChildrenMixin;
  iconName: string;
}

/**
 * Lucide icons in or under the selection, in layer order, outermost first.
 * Instances of a local Lucide component that is also selected are left out:
 * redrawing the component updates them.
 */
async function findLucideIcons(roots: readonly SceneNode[]): Promise<LucideMatch[]> {
  const matches: LucideMatch[] = [];
  const seen = new Set<string>();
  const stack = [...roots].reverse();
  let visited = 0;
  while (stack.length > 0 && visited < MAX_SCAN_NODES) {
    const node = stack.pop()!;
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    visited += 1;
    if (ICON_LAYER_TYPES.has(node.type) && "children" in node) {
      const iconName = lucideIconName(node.name);
      if (iconName && isOutlineIcon(node) && !insideInstance(node) && !(await isVadivamIcon(node))) {
        matches.push({ node, iconName });
        continue;
      }
    }
    // Layers inside an instance can't be replaced on their own.
    if (node.type !== "INSTANCE" && "children" in node) {
      for (let index = node.children.length - 1; index >= 0; index -= 1) stack.push(node.children[index]!);
    }
  }
  const componentIds = new Set(
    matches.filter(({ node }) => node.type === "COMPONENT").map(({ node }) => node.id),
  );
  const swappable: LucideMatch[] = [];
  for (const match of matches) {
    const main = match.node.type === "INSTANCE" ? await match.node.getMainComponentAsync() : null;
    if (!main || !componentIds.has(main.id)) swappable.push(match);
  }
  return swappable;
}

let selectionScan = 0;

async function postLucideSelection(): Promise<void> {
  const scan = ++selectionScan;
  const matches = await findLucideIcons(figma.currentPage.selection);
  if (scan === selectionScan) post({ type: "lucide-selection", count: matches.length });
}

figma.on("selectionchange", () => {
  postLucideSelection().catch(reportError);
});

// Each Lucide layer becomes the first Vadivam component for its icon or an
// instance of it, keeping the layer's size, stroke color and weight, and place.
function swapLayer(
  node: SceneNode & ChildrenMixin,
  icon: CatalogIcon,
  components: Map<string, ComponentNode>,
): ComponentNode | InstanceNode {
  const parent = node.parent;
  if (!parent || !("insertChild" in parent)) {
    throw new Error(`${node.name} cannot be swapped in its current parent`);
  }
  const index = parent.children.indexOf(node);
  const paint = uniformStrokePaint(node);
  const weight = uniformStrokeWeight(node);
  const existing = components.get(icon.name);
  let replacement: ComponentNode | InstanceNode;
  if (existing) {
    replacement = existing.createInstance();
    replacement.resize(node.width, node.height);
  } else {
    const component = createComponent(icon);
    resizeIcon(component, node.width, node.height);
    // Instances of other sizes scale the glyph rather than pin it to a corner.
    for (const child of component.children) {
      if ("constraints" in child) child.constraints = { horizontal: "SCALE", vertical: "SCALE" };
    }
    components.set(icon.name, component);
    replacement = component;
  }
  applyStrokePaint(replacement, paint);
  applyStrokeWeight(replacement, weight);
  parent.insertChild(Math.max(0, index), replacement);
  copyLayoutContext(node, replacement);
  node.remove();
  return replacement;
}

async function swapLucideIcons(): Promise<void> {
  const matches = await findLucideIcons(figma.currentPage.selection);
  if (matches.length === 0) throw new Error("No Lucide icons in the selection");
  const components = new Map<string, ComponentNode>();
  const swapped: SceneNode[] = [];
  for (const { node, iconName } of matches) {
    const icon = catalog.get(iconName)!;
    if (node.type === "COMPONENT") {
      // A local Lucide component keeps its instances: its glyph is redrawn in place.
      const weight = uniformStrokeWeight(node);
      replaceComponentGlyph(node, icon);
      applyStrokeWeight(node, weight);
      swapped.push(node);
    } else {
      swapped.push(swapLayer(node, icon, components));
    }
  }
  figma.currentPage.selection = swapped;
  figma.commitUndo();
  complete(`Swapped ${swapped.length} Lucide icon${swapped.length === 1 ? "" : "s"} for Vadivam`);
}

async function performChoice(iconName: string): Promise<void> {
  const icon = catalog.get(iconName);
  if (!icon) throw new Error("Unknown Vadivam icon");
  const selection = figma.currentPage.selection;
  const isLastInsertion =
    selection.length === 1 && selection[0]?.id === lastInsertedComponentId;
  const previousInsertion = isLastInsertion
    ? (selection[0] as ComponentNode)
    : null;

  if (selection.length === 1 && !isLastInsertion) {
    const selected = selection[0];
    if (!selected) throw new Error("The selection is no longer available");
    if (selected.type === "COMPONENT" && taggedIconName(selected)) {
      const instances = await selected.getInstancesAsync();
      if (instances.length > 0) {
        const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        pendingReplacement = { requestId, targetId: selected.id, iconName };
        post({
          type: "confirm-replace",
          requestId,
          iconName,
          instanceCount: instances.length,
        });
        return;
      }
      replaceComponentGlyph(selected, icon);
      figma.commitUndo();
      complete(`Replaced with ${iconName}`);
      return;
    }
    if (await taggedInstance(selected)) {
      replaceInstance(selected as InstanceNode, icon);
      figma.commitUndo();
      complete(`Replaced this use with ${iconName}`);
      return;
    }
  }

  const component = createComponent(icon);
  lastInsertedComponentId = component.id;
  placeComponent(component, previousInsertion);
  figma.commitUndo();
  complete(`Inserted ${iconName}`);
}

async function confirmReplacement(requestId: string, accepted: boolean): Promise<void> {
  const pending = pendingReplacement;
  pendingReplacement = null;
  if (!pending || pending.requestId !== requestId) {
    throw new Error("This replacement request has expired");
  }
  if (!accepted) return;
  const node = await figma.getNodeByIdAsync(pending.targetId);
  const icon = catalog.get(pending.iconName);
  if (!node || node.type !== "COMPONENT" || !taggedIconName(node) || !icon) {
    throw new Error("The selected component is no longer available");
  }
  replaceComponentGlyph(node, icon);
  figma.commitUndo();
  complete(`Replaced with ${icon.name}`);
}

figma.ui.onmessage = async (message: unknown): Promise<void> => {
  if (!message || typeof message !== "object" || !("type" in message)) {
    reportError(new Error("Invalid plugin message"));
    return;
  }
  const request = message as UiToPluginMessage;
  try {
    if (request.type === "choose" && typeof request.iconName === "string") {
      await performChoice(request.iconName);
    } else if (
      request.type === "confirm-replace" &&
      typeof request.requestId === "string" &&
      typeof request.accepted === "boolean"
    ) {
      await confirmReplacement(request.requestId, request.accepted);
    } else if (request.type === "swap-lucide") {
      await swapLucideIcons();
    } else {
      throw new Error("Unsupported plugin action");
    }
  } catch (error) {
    reportError(error);
  }
};

post({ type: "catalog", count: icons.length });
postLucideSelection().catch(reportError);
