import icons from "vadivam:catalog";
import type { CatalogIcon } from "./catalog";
import type { PluginToUiMessage, UiToPluginMessage } from "./protocol";

const UI_WIDTH = 320;
const UI_HEIGHT = 480;
const INSERTION_GAP = 16;
const PLUGIN_DATA_KEY = "vadivam";
const PLUGIN_DATA_SCHEMA = 1;
const catalog = new Map(icons.map((icon) => [icon.name, icon]));

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

function tagComponent(component: ComponentNode, name: string): void {
  component.name = name;
  component.setPluginData(PLUGIN_DATA_KEY, iconMetadata(name));
  component.setRelaunchData({ replace: `Replace ${name}` });
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

function createComponent(icon: CatalogIcon): ComponentNode {
  const frame = figma.createNodeFromSvg(icon.svg);
  try {
    const component = figma.createComponentFromNode(frame);
    tagComponent(component, icon.name);
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
  source: ComponentNode | InstanceNode,
  target: ComponentNode,
): void {
  target.x = source.x;
  target.y = source.y;
  target.rotation = source.rotation;
  target.opacity = source.opacity;
  target.blendMode = source.blendMode;
  target.visible = source.visible;
  target.locked = source.locked;
  target.constraints = source.constraints;
  target.layoutAlign = source.layoutAlign;
  target.layoutGrow = source.layoutGrow;
  target.layoutPositioning = source.layoutPositioning;
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
  const source = figma.createNodeFromSvg(icon.svg);
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
  tagComponent(component, icon.name);
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
    } else {
      throw new Error("Unsupported plugin action");
    }
  } catch (error) {
    reportError(error);
  }
};

post({ type: "catalog", count: icons.length });
