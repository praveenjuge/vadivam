import icons, { lucideAliases } from "vadivam:catalog";
import { styles } from "../../../scripts/icon-styles.mjs";
import { messageFromError, postToUi } from "../../figma-shared/channel";
import {
  catalogSvg,
  createIconComponent,
  describeIconComponent,
  isIconStyle,
  swapArtwork,
  type CatalogIcon,
  type IconStyle,
} from "../../figma-shared/icons";
import { iconNames } from "../../figma-shared/names";
import type { PluginToUiMessage, UiToPluginMessage } from "./protocol";

const UI_WIDTH = 320;
const UI_HEIGHT = 480;
const INSERTION_GAP = 16;
const PLUGIN_DATA_KEY = "vadivam";
const PLUGIN_DATA_SCHEMA = 1;
const catalog = new Map(icons.map((icon) => [icon.name, icon]));
const names = iconNames(catalog.keys(), lucideAliases);
// Selections are scanned on every change, so stop after this many layers.
const MAX_SCAN_NODES = 5000;
const SHAPE_TYPES = new Set(["VECTOR", "LINE", "ELLIPSE", "RECTANGLE", "POLYGON", "STAR", "BOOLEAN_OPERATION"]);
const ICON_LAYER_TYPES = new Set(["FRAME", "GROUP", "COMPONENT", "INSTANCE"]);

interface PendingReplacement {
  requestId: string;
  targetId: string;
  iconName: string;
  style: IconStyle;
}

let pendingReplacement: PendingReplacement | null = null;
let lastInsertedComponentId: string | null = null;

figma.showUI(__html__, {
  width: UI_WIDTH,
  height: UI_HEIGHT,
  title: "Vadivam Icons",
  themeColors: true,
});

const post: (message: PluginToUiMessage) => void = postToUi;

function complete(message: string): void {
  figma.notify(message);
  post({ type: "complete" });
}

function reportError(error: unknown): void {
  figma.notify(messageFromError(error), { error: true });
  post({ type: "error" });
}

// Outline components carry no style, as before solid icons existed.
function iconMetadata(name: string, style: IconStyle): string {
  return JSON.stringify({ schema: PLUGIN_DATA_SCHEMA, iconName: name, ...(style === "solid" ? { style } : {}) });
}

// A solid component is named after its icon with a `-solid` suffix.
function componentName(name: string, style: IconStyle): string {
  return style === "solid" ? `${name}-solid` : name;
}

// Plugin data is private to this plugin, so it is always JSON this plugin wrote.
function taggedIconName(node: BaseNode & PluginDataMixin): string | null {
  const value = node.getPluginData(PLUGIN_DATA_KEY);
  if (!value) return null;
  const parsed = JSON.parse(value) as Record<string, unknown>;
  return parsed.schema === PLUGIN_DATA_SCHEMA && typeof parsed.iconName === "string" && catalog.has(parsed.iconName)
    ? parsed.iconName
    : null;
}

function tagComponent(component: ComponentNode, icon: CatalogIcon, style: IconStyle): void {
  component.name = componentName(icon.name, style);
  component.setPluginData(PLUGIN_DATA_KEY, iconMetadata(icon.name, style));
  component.setRelaunchData({ replace: `Replace ${component.name}` });
  describeIconComponent(component, icon, style);
}

function createComponent(icon: CatalogIcon, style: IconStyle): ComponentNode {
  return createIconComponent(icon, style, (component) => tagComponent(component, icon, style));
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

function uniformPaint(node: ChildrenMixin, key: "strokes" | "fills"): Paint[] | null {
  const strokes = geometryNodes(node)
    .map((child) => child[key] as readonly Paint[] | typeof figma.mixed)
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

// An icon's color is its stroke when outline and its fill when solid, so a
// replacement moves the color across when the style changes.
function iconPaint(node: ChildrenMixin): Paint[] | null {
  return uniformPaint(node, "strokes") ?? uniformPaint(node, "fills");
}

function applyIconPaint(node: ChildrenMixin, paints: readonly Paint[] | null, style: IconStyle): void {
  if (!paints) return;
  for (const child of geometryNodes(node)) {
    if (styles[style].stroked) child.strokes = clonePaints(paints);
    else child.fills = clonePaints(paints);
  }
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

function replaceComponentGlyph(component: ComponentNode, icon: CatalogIcon, style: IconStyle): void {
  const paint = iconPaint(component);
  const source = figma.createNodeFromSvg(catalogSvg(icon, style));
  scaleChildren(source.children, source.width, source.height, component.width, component.height);
  applyIconPaint(source, paint, style);
  swapArtwork(component, source);
  tagComponent(component, icon, style);
  figma.currentPage.selection = [component];
}

function replaceInstance(instance: InstanceNode, icon: CatalogIcon, style: IconStyle): void {
  const parent = instance.parent;
  if (!parent || !("insertChild" in parent)) {
    throw new Error("This icon cannot be replaced in its current parent");
  }
  const index = parent.children.indexOf(instance);
  const paint = iconPaint(instance);
  const component = createComponent(icon, style);
  try {
    resizeIcon(component, instance.width, instance.height);
    applyIconPaint(component, paint, style);
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

const visiblePaints = (node: BaseNode, key: "fills" | "strokes"): boolean => {
  const paints = key in node ? (node as unknown as Record<string, unknown>)[key] : [];
  // Mixed paints are something drawn, so they count as visible.
  return !Array.isArray(paints) || paints.some((paint: Paint) => paint.visible !== false && paint.opacity !== 0);
};

// A square, stroke-only drawing, like an icon pasted from Lucide or placed
// from its Figma library. A button or tile named "search" has a filled
// background somewhere, so it is never mistaken for one.
function isOutlineIcon(node: SceneNode & ChildrenMixin): boolean {
  if (Math.abs(node.width - node.height) > 0.5 || node.width < 8 || node.width > 256) return false;
  if (visiblePaints(node, "fills")) return false;
  let stroked = 0;
  const stack: SceneNode[] = [...node.children];
  while (stack.length > 0) {
    const child = stack.pop()!;
    if (visiblePaints(child, "fills")) return false;
    if (SHAPE_TYPES.has(child.type)) {
      if (visiblePaints(child, "strokes")) stroked += 1;
    } else if ((child.type === "GROUP" || child.type === "FRAME") && "children" in child) {
      stack.push(...child.children);
    } else {
      return false;
    }
  }
  return stroked > 0;
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
      // Deprecated Lucide names, such as `home`, still name icons in older designs.
      const iconName = names.icon(node.name);
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
  const paint = uniformPaint(node, "strokes");
  const weight = uniformStrokeWeight(node);
  const existing = components.get(icon.name);
  const replacement = existing ? existing.createInstance() : createComponent(icon, "outline");
  try {
    if (replacement.type === "INSTANCE") {
      replacement.resize(node.width, node.height);
    } else {
      resizeIcon(replacement, node.width, node.height);
      // Instances of other sizes scale the glyph rather than pin it to a corner.
      for (const child of replacement.children) {
        if ("constraints" in child) child.constraints = { horizontal: "SCALE", vertical: "SCALE" };
      }
    }
    applyStrokePaint(replacement, paint);
    applyStrokeWeight(replacement, weight);
    parent.insertChild(Math.max(0, index), replacement);
    copyLayoutContext(node, replacement);
    node.remove();
  } catch (error) {
    if (!replacement.removed) replacement.remove();
    throw error;
  }
  // Only a component that made it into the document is reused for repeats.
  if (replacement.type === "COMPONENT") components.set(icon.name, replacement);
  return replacement;
}

async function swapLucideIcons(): Promise<void> {
  const matches = await findLucideIcons(figma.currentPage.selection);
  if (matches.length === 0) throw new Error("No Lucide icons in the selection");
  const components = new Map<string, ComponentNode>();
  const swapped: SceneNode[] = [];
  const failed: string[] = [];
  let firstError: unknown;
  // A layer that can't be swapped is skipped and reported; the rest still
  // swap, and the whole batch is one undo step.
  for (const { node, iconName } of matches) {
    const icon = catalog.get(iconName)!;
    const name = node.name;
    try {
      if (node.type === "COMPONENT") {
        // A local Lucide component keeps its instances: its glyph is redrawn in place.
        const weight = uniformStrokeWeight(node);
        replaceComponentGlyph(node, icon, "outline");
        applyStrokeWeight(node, weight);
        swapped.push(node);
      } else {
        swapped.push(swapLayer(node, icon, components));
      }
    } catch (error) {
      firstError ??= error;
      failed.push(name);
    }
  }
  if (swapped.length === 0) throw firstError;
  figma.currentPage.selection = swapped;
  figma.commitUndo();
  const summary = `Swapped ${swapped.length} Lucide icon${swapped.length === 1 ? "" : "s"} for Vadivam`;
  complete(
    failed.length === 0
      ? summary
      : `${summary}; couldn't swap ${failed.join(", ")}: ${messageFromError(firstError)}`,
  );
}

async function performChoice(iconName: string, style: IconStyle): Promise<void> {
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
        pendingReplacement = { requestId, targetId: selected.id, iconName, style };
        post({
          type: "confirm-replace",
          requestId,
          iconName,
          instanceCount: instances.length,
        });
        return;
      }
      replaceComponentGlyph(selected, icon, style);
      figma.commitUndo();
      complete(`Replaced with ${componentName(iconName, style)}`);
      return;
    }
    if (await taggedInstance(selected)) {
      replaceInstance(selected as InstanceNode, icon, style);
      figma.commitUndo();
      complete(`Replaced this use with ${componentName(iconName, style)}`);
      return;
    }
  }

  const component = createComponent(icon, style);
  lastInsertedComponentId = component.id;
  placeComponent(component, previousInsertion);
  figma.commitUndo();
  complete(`Inserted ${componentName(iconName, style)}`);
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
  replaceComponentGlyph(node, icon, pending.style);
  figma.commitUndo();
  complete(`Replaced with ${componentName(icon.name, pending.style)}`);
}

figma.ui.onmessage = async (message: unknown): Promise<void> => {
  if (!message || typeof message !== "object" || !("type" in message)) {
    reportError(new Error("Invalid plugin message"));
    return;
  }
  const request = message as UiToPluginMessage;
  try {
    if (request.type === "choose" && typeof request.iconName === "string" && isIconStyle(request.style)) {
      await performChoice(request.iconName, request.style);
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

post({ type: "ready" });
postLucideSelection().catch(reportError);
