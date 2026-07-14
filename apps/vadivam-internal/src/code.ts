import {
  getMissingIcons,
  parseBatchSize,
  parsePopularFeed,
  type PopularFeed,
  type PopularIcon,
} from "./catalog";
import { getBatchPositions, getGridPositions, ICON_SIZE } from "./layout";
import popularIcons from "./data/popular-icons.json";
import { lucideIconNames, resolveLucideIconName } from "./lucide";
import type {
  CatalogSummary,
  IconAuditIssue,
  PluginToUiMessage,
  UiToPluginMessage,
} from "./protocol";

const UI_WIDTH = 360;
const UI_HEIGHT = 620;
const ARRANGE_COLUMNS = 20;
const feed: PopularFeed = parsePopularFeed(popularIcons, resolveLucideIconName);
const allowedIconNames = new Set(lucideIconNames);

let batchSize = 20;
let existingSlugs = new Set<string>();
let candidates: PopularIcon[] = [];

figma.showUI(__html__, {
  width: UI_WIDTH,
  height: UI_HEIGHT,
  themeColors: true,
});

function post(message: PluginToUiMessage): void {
  figma.ui.postMessage(message);
}

function isIconContainer(node: SceneNode): node is FrameNode | ComponentNode | InstanceNode {
  return node.type === "FRAME" || node.type === "COMPONENT" || node.type === "INSTANCE";
}

function currentKnownIcons(): Array<FrameNode | ComponentNode | InstanceNode> {
  return figma.currentPage.children.filter(
    (node): node is FrameNode | ComponentNode | InstanceNode =>
      isIconContainer(node) && resolveLucideIconName(node.name) !== null,
  );
}

function isCanonicalIconNode(node: SceneNode): boolean {
  return (
    Math.abs(node.width - ICON_SIZE) < 0.01 &&
    Math.abs(node.height - ICON_SIZE) < 0.01 &&
    resolveLucideIconName(node.name) !== null
  );
}

async function scanDocument(): Promise<Set<string>> {
  await figma.loadAllPagesAsync();
  const names = new Set<string>();
  for (const page of figma.root.children) {
    for (const node of page.children) {
      const iconName = resolveLucideIconName(node.name);
      if (isCanonicalIconNode(node) && iconName) names.add(iconName);
    }
  }
  return names;
}

function summary(): CatalogSummary {
  const matchedCount = feed.icons.length - candidates.length;
  return {
    existingCount: existingSlugs.size,
    matchedCount,
    remainingCount: candidates.length,
    scannedAt: feed.scannedAt,
    methodology: feed.methodology,
    currentPage: figma.currentPage.name,
  };
}

function publishCatalog(): void {
  post({
    type: "catalog",
    summary: summary(),
    candidates: candidates.slice(0, batchSize),
  });
}

async function refreshCatalog(): Promise<void> {
  post({ type: "loading" });
  existingSlugs = await scanDocument();
  candidates = getMissingIcons(feed.icons, existingSlugs);
  publishCatalog();
}

function createIconFrame(name: string, position: { x: number; y: number }): FrameNode {
  const frame = figma.createFrame();
  frame.name = name;
  frame.resize(ICON_SIZE, ICON_SIZE);
  frame.x = position.x;
  frame.y = position.y;
  frame.fills = [
    { type: "SOLID", color: { r: 1, g: 1, b: 1 }, opacity: 1, visible: true },
  ];
  frame.strokes = [];
  frame.strokeWeight = 0.5;
  frame.clipsContent = false;
  frame.layoutGrids = [
    {
      pattern: "GRID",
      sectionSize: 2,
      visible: true,
      color: { r: 1, g: 0, b: 0, a: 0.1 },
    },
  ];
  frame.exportSettings = [
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
  return frame;
}

function generateFrames(countValue: unknown): void {
  const count = parseBatchSize(countValue);
  const selected = candidates.slice(0, count);
  if (selected.length === 0) throw new Error("No missing ranked icons remain");

  const currentIcons = figma.currentPage.children.filter(isCanonicalIconNode);
  const positions = getBatchPositions(
    selected.length,
    currentIcons.map((node) => ({ x: node.x, y: node.y })),
    figma.viewport.center,
  );
  const frames = selected.map((icon, index) =>
    createIconFrame(icon.slug, positions[index] as { x: number; y: number }),
  );

  figma.currentPage.selection = frames;
  figma.viewport.scrollAndZoomIntoView(frames);
  for (const icon of selected) existingSlugs.add(icon.slug);
  candidates = getMissingIcons(feed.icons, existingSlugs);
  post({ type: "generated", names: selected.map((icon) => icon.slug) });
  publishCatalog();
}

function arrangeIcons(): void {
  const icons = currentKnownIcons().sort((left, right) =>
    (resolveLucideIconName(left.name) ?? left.name).localeCompare(
      resolveLucideIconName(right.name) ?? right.name,
    ),
  );
  if (icons.length === 0) throw new Error("No recognized Lucide icons on this page");
  const origin = {
    x: Math.min(...icons.map((node) => node.x)),
    y: Math.min(...icons.map((node) => node.y)),
  };
  const positions = getGridPositions(icons.length, ARRANGE_COLUMNS, origin);
  icons.forEach((icon, index) => {
    const position = positions[index];
    if (!position) return;
    icon.x = position.x;
    icon.y = position.y;
  });
  figma.currentPage.selection = icons;
  figma.viewport.scrollAndZoomIntoView(icons);
  post({ type: "arranged", count: icons.length });
}

function hasVisiblePaint(paints: readonly Paint[] | typeof figma.mixed): boolean {
  return (
    paints !== figma.mixed &&
    paints.some(
      (paint) => paint.visible !== false && (paint.opacity === undefined || paint.opacity > 0),
    )
  );
}

function addViolation(violations: Set<string>, condition: boolean, message: string): void {
  if (condition) violations.add(message);
}

interface IconAuditResult {
  issue: IconAuditIssue | null;
  renamed: number;
  rounded: number;
}

function auditIcon(icon: FrameNode | ComponentNode | InstanceNode): IconAuditResult {
  const violations = new Set<string>();
  let renamed = 0;
  let rounded = 0;
  const slug = resolveLucideIconName(icon.name);
  addViolation(violations, !slug || !allowedIconNames.has(slug), "Name is not in Lucide");
  addViolation(
    violations,
    Math.abs(icon.width - ICON_SIZE) >= 0.01 || Math.abs(icon.height - ICON_SIZE) >= 0.01,
    "Frame must be 24×24",
  );
  addViolation(violations, Math.abs(icon.rotation) >= 0.01, "Rotation must be 0°");
  addViolation(
    violations,
    hasVisiblePaint(icon.fills),
    "Frame must have no background fill",
  );
  addViolation(
    violations,
    icon.layoutGrids.length > 0,
    "Frame must have no layout guides",
  );
  if ("cornerRadius" in icon) {
    addViolation(
      violations,
      icon.cornerRadius === figma.mixed || icon.cornerRadius !== 0,
      "Corner radius must be 0",
    );
  }

  const descendants = icon.findAll(() => true);
  const artwork = descendants.filter(
    (node): node is SceneNode & GeometryMixin =>
      "fills" in node && "strokes" in node && "strokeCap" in node,
  );
  addViolation(violations, artwork.length === 0, "No stroke artwork");

  for (const node of descendants) {
    if ("rotation" in node) {
      addViolation(
        violations,
        Math.abs(node.rotation) >= 0.01,
        "Artwork rotation must be 0°",
      );
    }
    if ("cornerRadius" in node) {
      addViolation(
        violations,
        node.cornerRadius === figma.mixed || node.cornerRadius !== 0,
        "Artwork corner radius must be 0",
      );
    }
  }

  for (const node of artwork) {
    const hasStroke = hasVisiblePaint(node.strokes);
    if (hasStroke && node.name !== "Vector") {
      node.name = "Vector";
      renamed += 1;
    }
    if (hasStroke && node.strokeCap !== "ROUND") {
      node.strokeCap = "ROUND";
      rounded += 1;
    }
    addViolation(violations, hasVisiblePaint(node.fills), "Artwork must have no fill");
    addViolation(violations, !hasStroke, "Artwork must use strokes");
    addViolation(
      violations,
      node.strokeWeight === figma.mixed || Math.abs(node.strokeWeight - 2) >= 0.01,
      "Stroke weight must be 2 px",
    );
    addViolation(violations, node.strokeJoin !== "ROUND", "Stroke joins must be round");
  }

  return {
    issue:
      violations.size > 0
        ? { name: icon.name, violations: [...violations] }
        : null,
    renamed,
    rounded,
  };
}

function auditIcons(): void {
  const icons = figma.currentPage.children.filter(isIconContainer);
  if (icons.length === 0) throw new Error("No icon frames on this page");
  const results = icons.map(auditIcon);
  const issues = results
    .map((result) => result.issue)
    .filter((issue): issue is IconAuditIssue => issue !== null)
    .sort((left, right) => left.name.localeCompare(right.name));
  post({
    type: "audit",
    summary: {
      checked: icons.length,
      passed: icons.length - issues.length,
      failed: issues.length,
      renamed: results.reduce((total, result) => total + result.renamed, 0),
      rounded: results.reduce((total, result) => total + result.rounded, 0),
    },
    issues,
  });
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected plugin error";
}

figma.ui.onmessage = async (message: unknown): Promise<void> => {
  if (!message || typeof message !== "object" || !("type" in message)) {
    post({ type: "error", message: "Invalid plugin message" });
    return;
  }

  const request = message as UiToPluginMessage;
  try {
    if (request.type === "refresh") {
      await refreshCatalog();
    } else if (request.type === "set-count") {
      batchSize = parseBatchSize(request.count);
      publishCatalog();
    } else if (request.type === "generate") {
      generateFrames(request.count);
    } else if (request.type === "arrange") {
      arrangeIcons();
    } else if (request.type === "audit") {
      auditIcons();
    } else {
      post({ type: "error", message: "Unsupported plugin action" });
    }
  } catch (error) {
    post({ type: "error", message: messageFromError(error) });
  }
};

refreshCatalog().catch((error: unknown) => {
  post({ type: "error", message: messageFromError(error) });
});
