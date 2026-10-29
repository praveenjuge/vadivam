import {
  getMissingIcons,
  parseBatchSize,
  parseLucideCatalog,
  type LucideCatalog,
  type LucideIconRanking,
} from "./catalog";
import iconCatalog from "vadivam:icon-catalog";
import {
  DEFAULT_COLUMNS,
  getBatchPositions,
  getGridPositions,
  ICON_SIZE,
  parseColumns,
} from "./layout";
import lucideRankings from "./data/lucide-icon-rankings.json";
import {
  getDeprecatedLucideReplacement,
  lucideIconNames,
  resolveLucideIconName,
} from "./lucide";
import {
  MAX_SVG_FILES,
  MAX_SVG_LENGTH,
  TABS,
  type CatalogSummary,
  type IconAuditIssue,
  type PluginSettings,
  type PluginToUiMessage,
  type ReplacedIcon,
  type RenameSuggestion,
  type SkippedSvg,
  type SvgFile,
  type Tab,
  type UiToPluginMessage,
} from "./protocol";
import { isRemoteSource, loadRemoteCatalog, type RemoteCatalog, type RemoteSource } from "./remote";
import { suggestRenameIdeas, toKebabName } from "./rename";

const UI_WIDTH = 420;
const UI_HEIGHT = 600;
const SETTINGS_KEY = "settings";
// The published component set keeps a fixed width; Arrange columns are a per-user setting.
const LIBRARY_COLUMNS = 40;
const LIBRARY_GAP = 24;
const LIBRARY_PADDING = 24;
const LIBRARY_NAME = "Vadivam Icons";
const LIBRARY_DATA_KEY = "vadivam-internal";
const LIBRARY_SCHEMA = 1;
const DOCUMENTATION_URL = "https://vadivam.praveenjuge.com";
const catalog: LucideCatalog = parseLucideCatalog(
  lucideRankings,
  resolveLucideIconName,
);
const allowedIconNames = new Set(lucideIconNames);
const libraryIcons = new Map(iconCatalog.map((icon) => [icon.name, icon]));

let settings: PluginSettings = { batchSize: 20, columns: DEFAULT_COLUMNS, tab: "create" };
let existingSlugs = new Set<string>();
// The last catalog read from GitHub or npm, reused when its icons are added.
let remoteCatalog: RemoteCatalog | null = null;
let candidates: LucideIconRanking[] = [];

figma.showUI(__html__, {
  width: UI_WIDTH,
  height: UI_HEIGHT,
  themeColors: true,
});

function post(message: PluginToUiMessage): void {
  figma.ui.postMessage(message);
}

function pluginData(value: Record<string, unknown>): string {
  return JSON.stringify({ schema: LIBRARY_SCHEMA, ...value });
}

function readPluginData(node: BaseNode): Record<string, unknown> | null {
  const value = node.getPluginData(LIBRARY_DATA_KEY);
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return parsed.schema === LIBRARY_SCHEMA ? parsed : null;
  } catch {
    return null;
  }
}

function isLibrarySet(node: BaseNode): node is ComponentSetNode {
  return node.type === "COMPONENT_SET" && readPluginData(node)?.kind === "library";
}

function librarySetsOnPage(): ComponentSetNode[] {
  return figma.currentPage
    .findAll((node) => node.type === "COMPONENT_SET")
    .filter(isLibrarySet);
}

function isTab(value: unknown): value is Tab {
  return (TABS as readonly unknown[]).includes(value);
}

// Settings are a convenience, so anything missing or invalid falls back to its default.
async function loadSettings(): Promise<PluginSettings> {
  const defaults = settings;
  let stored: Partial<Record<keyof PluginSettings, unknown>> = {};
  try {
    stored = (await figma.clientStorage.getAsync(SETTINGS_KEY)) ?? {};
  } catch {
    return defaults;
  }
  const valid = <T>(parse: (value: unknown) => T, value: unknown, fallback: T): T => {
    try {
      return parse(value);
    } catch {
      return fallback;
    }
  };
  return {
    batchSize: valid(parseBatchSize, stored.batchSize, defaults.batchSize),
    columns: valid(parseColumns, stored.columns, defaults.columns),
    tab: isTab(stored.tab) ? stored.tab : defaults.tab,
  };
}

async function saveSettings(next: Partial<PluginSettings>): Promise<void> {
  settings = { ...settings, ...next };
  await figma.clientStorage.setAsync(SETTINGS_KEY, settings);
}

type IconContainer = FrameNode | ComponentNode | InstanceNode;
type IconStyle = "outline" | "solid";

// Solid icons live on their own page, one whose name contains "Solid", with
// frames named like their outline twins. Names, missing icons, and the audit
// are scoped to the pages of the current page's style.
function pageStyle(page: PageNode): IconStyle {
  return /\bsolid\b/i.test(page.name) ? "solid" : "outline";
}

function stylePages(): PageNode[] {
  const style = pageStyle(figma.currentPage);
  return figma.root.children.filter((page) => pageStyle(page) === style);
}

function isIconContainer(node: SceneNode): node is IconContainer {
  return node.type === "FRAME" || node.type === "COMPONENT" || node.type === "INSTANCE";
}

function isIconSized(node: SceneNode): boolean {
  return (
    Math.abs(node.width - ICON_SIZE) < 0.01 && Math.abs(node.height - ICON_SIZE) < 0.01
  );
}

function isCanonicalIconNode(node: SceneNode): boolean {
  return isIconSized(node) && resolveLucideIconName(node.name) !== null;
}

// Top-level 24×24 icon frames on this page, whether or not their names are current.
function pageIconFrames(): IconContainer[] {
  return figma.currentPage.children.filter(
    (node): node is IconContainer => isIconContainer(node) && isIconSized(node),
  );
}

function publishPageStatus(): void {
  post({
    type: "page",
    page: {
      name: figma.currentPage.name,
      iconFrames: pageIconFrames().length,
      hasLibrary: librarySetsOnPage().length > 0,
      libraryIcons: iconCatalog.length,
    },
  });
}

// Canonical icon frames across every page, keyed by their Lucide name. Call
// after figma.loadAllPagesAsync(); it is synchronous so callers can check and
// rename without another message running in between.
function iconNameOwners(): Map<string, SceneNode[]> {
  const owners = new Map<string, SceneNode[]>();
  for (const page of stylePages()) {
    for (const node of page.children) {
      const iconName = resolveLucideIconName(node.name);
      if (isCanonicalIconNode(node) && iconName) {
        owners.set(iconName, [...(owners.get(iconName) ?? []), node]);
      }
    }
  }
  return owners;
}

function isOwnedByAnother(
  owners: ReadonlyMap<string, SceneNode[]>,
  name: string,
  node: SceneNode,
): boolean {
  return (owners.get(name) ?? []).some((owner) => owner !== node);
}

// Every name a top-level 24×24 icon frame in the file answers to, so "ArrowRight",
// "arrow_right", and a deprecated alias all count as that icon. Call after
// figma.loadAllPagesAsync().
function fileIconNames(): Set<string> {
  const names = new Set<string>();
  for (const page of stylePages()) {
    for (const node of page.children) {
      if (!isIconContainer(node) || !isIconSized(node)) continue;
      const key = toKebabName(node.name);
      names.add(key);
      const lucideName = resolveLucideIconName(key) ?? getDeprecatedLucideReplacement(key);
      if (lucideName) names.add(lucideName);
    }
  }
  return names;
}

async function scanDocument(): Promise<Set<string>> {
  await figma.loadAllPagesAsync();
  return new Set(iconNameOwners().keys());
}

function summary(): CatalogSummary {
  const matchedCount = catalog.icons.length - candidates.length;
  return {
    existingCount: existingSlugs.size,
    matchedCount,
    remainingCount: candidates.length,
    lucideVersion: catalog.lucideVersion,
    retrievedAt: catalog.retrievedAt,
    source: catalog.source,
    ranking: catalog.ranking,
    currentPage: figma.currentPage.name,
  };
}

function publishCatalog(): void {
  post({
    type: "catalog",
    summary: summary(),
    candidates: candidates.slice(0, settings.batchSize),
  });
}

// The style the catalog was last scanned for; the names and missing icons
// change when the current page moves to the other style.
let scannedStyle: IconStyle | null = null;

async function refreshCatalog(): Promise<void> {
  post({ type: "loading" });
  scannedStyle = pageStyle(figma.currentPage);
  existingSlugs = await scanDocument();
  candidates = getMissingIcons(catalog.icons, existingSlugs);
  publishCatalog();
  publishPageStatus();
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

function iconDocumentationUrl(name: string): string {
  return `${DOCUMENTATION_URL}/icons/${encodeURIComponent(name)}`;
}

function taggedLibraryIconName(node: ComponentNode): string | null {
  const data = readPluginData(node);
  return data?.kind === "icon" && typeof data.name === "string" ? data.name : null;
}

// Components tagged before solid icons existed are outline.
function taggedLibraryIconStyle(node: ComponentNode): IconStyle {
  return readPluginData(node)?.style === "solid" ? "solid" : "outline";
}

const styleLabel = (style: IconStyle) => (style === "solid" ? "Solid" : "Outline");

// Public copy for the published library; category titles and tags stay plain words for search.
function libraryIconDescription(name: string, style: IconStyle): string {
  const icon = libraryIcons.get(name);
  return [
    `24 px ${style} icon from Vadivam.`,
    icon?.categories.length ? `**Categories:** ${icon.categories.join(", ")}` : "",
    icon?.tags.length ? `**Tags:** ${icon.tags.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function tagLibraryComponent(component: ComponentNode, name: string, style: IconStyle): void {
  component.name = `Icon=${name}, Style=${styleLabel(style)}`;
  component.resizeWithoutConstraints(ICON_SIZE, ICON_SIZE);
  component.setPluginData(
    LIBRARY_DATA_KEY,
    pluginData({ kind: "icon", name, style }),
  );
  component.setRelaunchData({
    "sync-library": `Update ${name}`,
  });
  component.descriptionMarkdown = libraryIconDescription(name, style);
  component.documentationLinks = [{ uri: iconDocumentationUrl(name) }];
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

function configureLibrarySet(componentSet: ComponentSetNode): void {
  componentSet.name = LIBRARY_NAME;
  componentSet.layoutMode = "HORIZONTAL";
  componentSet.layoutWrap = "WRAP";
  componentSet.primaryAxisSizingMode = "FIXED";
  componentSet.counterAxisSizingMode = "AUTO";
  componentSet.primaryAxisAlignItems = "MIN";
  componentSet.counterAxisAlignItems = "MIN";
  componentSet.paddingTop = LIBRARY_PADDING;
  componentSet.paddingRight = LIBRARY_PADDING;
  componentSet.paddingBottom = LIBRARY_PADDING;
  componentSet.paddingLeft = LIBRARY_PADDING;
  componentSet.itemSpacing = LIBRARY_GAP;
  componentSet.counterAxisSpacing = LIBRARY_GAP;
  componentSet.fills = [
    { type: "SOLID", color: { r: 1, g: 1, b: 1 } },
  ];
  componentSet.strokes = [];
  componentSet.cornerRadius = 0;
  componentSet.clipsContent = false;
  const width =
    LIBRARY_COLUMNS * ICON_SIZE +
    (LIBRARY_COLUMNS - 1) * LIBRARY_GAP +
    LIBRARY_PADDING * 2;
  componentSet.resizeWithoutConstraints(width, Math.max(componentSet.height, ICON_SIZE));
  componentSet.setPluginData(
    LIBRARY_DATA_KEY,
    pluginData({ kind: "library", columns: LIBRARY_COLUMNS }),
  );
  componentSet.setRelaunchData({
    "sync-library": "Update all icons",
  });
  componentSet.descriptionMarkdown = `${iconCatalog.length} open-source icons on a 24 px grid, each in an outline and a solid style. Pick an icon with the **Icon** property and a style with **Style**, then change the color as needed.`;
  componentSet.documentationLinks = [{ uri: DOCUMENTATION_URL }];
}

interface LibraryIcon {
  name: string;
  svg: string;
  solidSvg: string;
}

const librarySvg = (icon: LibraryIcon, style: IconStyle) => (style === "solid" ? icon.solidSvg : icon.svg);
const LIBRARY_STYLES: IconStyle[] = ["outline", "solid"];

function createLibraryComponent(icon: LibraryIcon, style: IconStyle): ComponentNode {
  const frame = figma.createNodeFromSvg(librarySvg(icon, style));
  try {
    const component = figma.createComponentFromNode(frame);
    tagLibraryComponent(component, icon.name, style);
    return component;
  } catch (error) {
    if (!frame.removed) frame.remove();
    throw error;
  }
}

// Swaps a node's layers for a 24×24 SVG's layers; the node itself and its settings stay.
function replaceArtwork(target: FrameNode | ComponentNode, svg: string): void {
  const source = figma.createNodeFromSvg(svg);
  const oldChildren = [...target.children];
  const moved: SceneNode[] = [];
  try {
    if (!isIconSized(source)) throw new Error("SVG must be 24×24");
    for (const child of [...source.children]) {
      target.appendChild(child);
      moved.push(child);
    }
  } catch (error) {
    for (const child of moved) source.appendChild(child);
    source.remove();
    throw error;
  }
  for (const child of oldChildren) child.remove();
  source.remove();
}

function replaceLibraryGlyph(component: ComponentNode, icon: LibraryIcon, style: IconStyle): void {
  replaceArtwork(component, librarySvg(icon, style));
  tagLibraryComponent(component, icon.name, style);
}

function selectedLibrarySet(): ComponentSetNode | null {
  let node: BaseNode | null = figma.currentPage.selection[0] ?? null;
  while (node && node.type !== "PAGE" && node.type !== "DOCUMENT") {
    if (isLibrarySet(node)) return node;
    node = node.parent;
  }
  return null;
}

function librarySetForUpdate(): ComponentSetNode | null {
  const selected = selectedLibrarySet();
  if (selected) return selected;
  const sets = librarySetsOnPage();
  if (sets.length > 1) {
    throw new Error("Select the Vadivam icon library you want to update");
  }
  return sets[0] ?? null;
}

function createIconLibrary(): ComponentSetNode {
  const components: ComponentNode[] = [];
  let componentSet: ComponentSetNode | null = null;
  try {
    for (const icon of iconCatalog) {
      for (const style of LIBRARY_STYLES) components.push(createLibraryComponent(icon, style));
    }
    componentSet = figma.combineAsVariants(components, figma.currentPage);
    for (const component of components) {
      const name = taggedLibraryIconName(component);
      if (name) tagLibraryComponent(component, name, taggedLibraryIconStyle(component));
    }
    configureLibrarySet(componentSet);
    componentSet.x = Math.round(figma.viewport.center.x - componentSet.width / 2);
    componentSet.y = Math.round(figma.viewport.center.y - componentSet.height / 2);
    return componentSet;
  } catch (error) {
    if (componentSet && !componentSet.removed) componentSet.remove();
    for (const component of components) {
      if (!component.removed) component.remove();
    }
    throw error;
  }
}

function updateIconLibrary(componentSet: ComponentSetNode): {
  added: number;
  retained: number;
} {
  // Keyed by icon and style; existing outline components keep their identity
  // and gain the Style property, and each solid variant is added beside them.
  const existing = new Map<string, ComponentNode>();
  for (const child of componentSet.children) {
    if (child.type !== "COMPONENT") continue;
    const name = taggedLibraryIconName(child);
    const key = name && `${name}:${taggedLibraryIconStyle(child)}`;
    if (key && !existing.has(key)) existing.set(key, child);
  }

  let added = 0;
  const canonicalComponents: ComponentNode[] = [];
  for (const icon of iconCatalog) {
    for (const style of LIBRARY_STYLES) {
      let component = existing.get(`${icon.name}:${style}`);
      if (component) {
        replaceLibraryGlyph(component, icon, style);
      } else {
        component = createLibraryComponent(icon, style);
        componentSet.appendChild(component);
        added += 1;
      }
      canonicalComponents.push(component);
    }
  }
  canonicalComponents.forEach((component, index) => {
    componentSet.insertChild(index, component);
  });
  configureLibrarySet(componentSet);
  return {
    added,
    retained: Math.max(0, componentSet.children.length - canonicalComponents.length),
  };
}

function syncIconLibrary(): void {
  const existing = librarySetForUpdate();
  const componentSet = existing ?? createIconLibrary();
  const result = existing
    ? updateIconLibrary(existing)
    : { added: iconCatalog.length * LIBRARY_STYLES.length, retained: 0 };
  figma.currentPage.selection = [componentSet];
  figma.viewport.scrollAndZoomIntoView([componentSet]);
  figma.commitUndo();
  publishPageStatus();
  post({
    type: "library-synced",
    count: iconCatalog.length,
    created: existing === null,
    added: result.added,
    retained: result.retained,
  });
}

function parseRemoteSource(value: unknown): RemoteSource {
  if (!isRemoteSource(value)) throw new Error("Choose GitHub or npm");
  return value;
}

async function readRemoteCatalog(source: RemoteSource, reuse: boolean): Promise<RemoteCatalog> {
  const style = pageStyle(figma.currentPage);
  if (reuse && remoteCatalog?.source === source && remoteCatalog.style === style) return remoteCatalog;
  remoteCatalog = await loadRemoteCatalog(source, fetch, style);
  return remoteCatalog;
}

async function missingRemoteIcons(remote: RemoteCatalog): Promise<string[]> {
  await figma.loadAllPagesAsync();
  const present = fileIconNames();
  return remote.names.filter((name) => !present.has(name));
}

// Lists icons on GitHub main or npm latest that no icon frame in this file has yet.
async function checkRemote(sourceValue: unknown): Promise<void> {
  const source = parseRemoteSource(sourceValue);
  const remote = await readRemoteCatalog(source, false);
  post({
    type: "remote-checked",
    source,
    version: remote.version,
    total: remote.names.length,
    missing: await missingRemoteIcons(remote),
  });
}

// Adds a frame on this page for every icon from the checked source that the file
// lacks, then sorts the page A–Z like Replace, as one undo step. Existing frames
// keep their artwork, so edits made in Figma are never overwritten.
async function addRemote(sourceValue: unknown): Promise<void> {
  const source = parseRemoteSource(sourceValue);
  // The artwork downloaded is for this page's style, so it lands only here.
  const page = figma.currentPage;
  const remote = await readRemoteCatalog(source, true);
  const { icons, failed } = await remote.loadSvgs(await missingRemoteIcons(remote));
  if (figma.currentPage !== page) {
    throw new Error(`The page changed while icons downloaded; go back to ${page.name} and add them again`);
  }

  const added: string[] = [];
  const frames: FrameNode[] = [];
  // Read again after the downloads; the file may have changed meanwhile.
  const present = fileIconNames();
  for (const icon of icons) {
    if (present.has(icon.name)) continue;
    try {
      frames.push(addIconFrame(icon.name, icon.svg));
      present.add(icon.name);
      added.push(icon.name);
    } catch (error) {
      failed.push({ name: icon.name, reason: messageFromError(error) });
    }
  }
  if (frames.length > 0) {
    layOutIconFrames(settings.columns);
    existingSlugs = new Set(iconNameOwners().keys());
    candidates = getMissingIcons(catalog.icons, existingSlugs);
    publishCatalog();
    figma.currentPage.selection = frames;
    figma.viewport.scrollAndZoomIntoView(frames);
    figma.commitUndo();
  }
  publishPageStatus();
  post({ type: "remote-added", source, version: remote.version, added, failed });
}

function generateFrames(countValue: unknown): void {
  const count = parseBatchSize(countValue);
  const selected = candidates.slice(0, count);
  if (selected.length === 0) throw new Error("No missing ranked icons remain");

  const names = selected.map((icon) => icon.name);
  createNamedFrames(names);
  publishCatalog();
  publishPageStatus();
  post({ type: "generated", names });
}

function createNamedFrames(names: readonly string[]): void {
  const currentIcons = figma.currentPage.children.filter(isCanonicalIconNode);
  const positions = getBatchPositions(
    names.length,
    settings.columns,
    currentIcons.map((node) => ({ x: node.x, y: node.y })),
    figma.viewport.center,
  );
  const frames = names.map((name, index) =>
    createIconFrame(name, positions[index] as { x: number; y: number }),
  );

  figma.currentPage.selection = frames;
  figma.viewport.scrollAndZoomIntoView(frames);
  for (const name of names) existingSlugs.add(name);
  candidates = getMissingIcons(catalog.icons, existingSlugs);
}

// Sorts this page's icon frames A–Z into a grid that starts at their top-left corner.
function layOutIconFrames(columns: number): IconContainer[] {
  const sortKey = (node: SceneNode): string =>
    resolveLucideIconName(node.name) ?? toKebabName(node.name);
  const icons = pageIconFrames().sort((left, right) =>
    sortKey(left).localeCompare(sortKey(right)),
  );
  if (icons.length === 0) return icons;
  const origin = {
    x: Math.min(...icons.map((node) => node.x)),
    y: Math.min(...icons.map((node) => node.y)),
  };
  const positions = getGridPositions(icons.length, columns, origin);
  icons.forEach((icon, index) => {
    const position = positions[index];
    if (!position) return;
    icon.x = position.x;
    icon.y = position.y;
  });
  return icons;
}

async function arrangeIcons(columnsValue: unknown): Promise<void> {
  const columns = parseColumns(columnsValue);
  if (columns !== settings.columns) await saveSettings({ columns });
  const icons = layOutIconFrames(columns);
  if (icons.length === 0) throw new Error("No icon frames on this page");
  figma.currentPage.selection = icons;
  figma.viewport.scrollAndZoomIntoView(icons);
  figma.commitUndo();
  post({
    type: "arranged",
    count: icons.length,
    columns,
    rows: Math.ceil(icons.length / columns),
  });
}

function parseSvgFiles(value: unknown): SvgFile[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_SVG_FILES) {
    throw new Error(`Choose between 1 and ${MAX_SVG_FILES} SVG files`);
  }
  return value.map((entry: unknown) => {
    const { name, svg } = (entry ?? {}) as { name?: unknown; svg?: unknown };
    if (typeof name !== "string" || typeof svg !== "string" || svg.length > MAX_SVG_LENGTH) {
      throw new Error("Invalid SVG file");
    }
    return { name, svg };
  });
}

// Creates an icon frame for an SVG with no matching frame. The caller lays the page out again.
function addIconFrame(name: string, svg: string): FrameNode {
  const position = getBatchPositions(
    1,
    settings.columns,
    pageIconFrames().map((node) => ({ x: node.x, y: node.y })),
    figma.viewport.center,
  )[0] as { x: number; y: number };
  const frame = createIconFrame(name, position);
  try {
    replaceArtwork(frame, svg);
  } catch (error) {
    frame.remove();
    throw error;
  }
  return frame;
}

// Each file replaces the artwork of the 24×24 frames on this page with the same
// name; "ArrowRight.svg", "arrow_right.svg", and "arrow-right.svg" all match "arrow-right".
// Files with no frame get a new one, and the page is sorted A–Z so it lands in place.
async function replaceIcons(filesValue: unknown): Promise<void> {
  const files = parseSvgFiles(filesValue);
  // Everything from here to the edits runs synchronously after this load.
  await figma.loadAllPagesAsync();
  const owners = iconNameOwners();
  const frames = new Map<string, IconContainer[]>();
  for (const node of pageIconFrames()) {
    const key = toKebabName(node.name);
    frames.set(key, [...(frames.get(key) ?? []), node]);
  }

  const replaced: ReplacedIcon[] = [];
  const added: ReplacedIcon[] = [];
  const skipped: SkippedSvg[] = [];
  const used = new Set<string>();
  for (const file of files) {
    const key = toKebabName(file.name.replace(/\.svg$/i, ""));
    if (!key) {
      skipped.push({ file: file.name, reason: "File name is not an icon name" });
      continue;
    }
    if (used.has(key)) {
      skipped.push({ file: file.name, reason: "Another file has the same icon name" });
      continue;
    }
    used.add(key);
    const targets = frames.get(key);
    if (!targets) {
      const name = resolveLucideIconName(key) ?? key;
      const owner = owners.get(name)?.[0];
      if (owner) {
        const page = owner.parent;
        skipped.push({
          file: file.name,
          reason:
            page === figma.currentPage
              ? `"${owner.name}" on this page is the same icon; rename it first`
              : `"${name}" is on the "${page?.name ?? "another"}" page`,
        });
        continue;
      }
      try {
        const frame = addIconFrame(name, file.svg);
        added.push({ id: frame.id, name: frame.name });
      } catch (error) {
        skipped.push({ file: file.name, reason: messageFromError(error) });
      }
      continue;
    }
    for (const target of targets) {
      if (target.type === "INSTANCE") {
        skipped.push({ file: file.name, reason: `"${target.name}" is an instance; detach it first` });
        continue;
      }
      try {
        replaceArtwork(target, file.svg);
        replaced.push({ id: target.id, name: target.name });
      } catch (error) {
        skipped.push({ file: file.name, reason: messageFromError(error) });
      }
    }
  }

  if (added.length > 0) {
    layOutIconFrames(settings.columns);
    for (const icon of added) existingSlugs.add(icon.name);
    candidates = getMissingIcons(catalog.icons, existingSlugs);
    publishCatalog();
    publishPageStatus();
  }
  if (replaced.length > 0 || added.length > 0) {
    const ids = new Set([...replaced, ...added].map((icon) => icon.id));
    const nodes = pageIconFrames().filter((node) => ids.has(node.id));
    figma.currentPage.selection = nodes;
    figma.viewport.scrollAndZoomIntoView(nodes);
    figma.commitUndo();
  }
  post({ type: "replaced", replaced, added, skipped });
}

async function publishRenameIdeas(renamed = 0): Promise<void> {
  await figma.loadAllPagesAsync();
  const frames = pageIconFrames();
  if (frames.length === 0) throw new Error("No icon frames on this page");
  const owners = iconNameOwners();
  existingSlugs = new Set(owners.keys());
  candidates = getMissingIcons(catalog.icons, existingSlugs);
  const icons: RenameSuggestion[] = frames
    .filter((node) => !allowedIconNames.has(node.name))
    .map((node) => ({
      id: node.id,
      name: node.name,
      ideas: suggestRenameIdeas(node.name).map((idea) => ({
        ...idea,
        taken: isOwnedByAnother(owners, idea.name, node),
      })),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  publishCatalog();
  publishPageStatus();
  post({ type: "rename-ideas", icons, renamed });
}

async function renameIcons(renames: unknown): Promise<void> {
  if (!Array.isArray(renames) || renames.length === 0 || renames.length > 10_000) {
    throw new Error("Invalid rename request");
  }
  // Everything from here to the rename runs synchronously after this load.
  await figma.loadAllPagesAsync();
  const frames = new Map(pageIconFrames().map((node) => [node.id, node]));
  const updates = renames.map((entry: unknown) => {
    const { id, name } = (entry ?? {}) as { id?: unknown; name?: unknown };
    const node = typeof id === "string" ? frames.get(id) : undefined;
    if (!node) throw new Error("An icon to rename is no longer on this page");
    if (typeof name !== "string" || !allowedIconNames.has(name)) {
      throw new Error("Rename target is not a current Lucide name");
    }
    return { node, name };
  });
  if (new Set(updates.map((update) => update.name)).size !== updates.length) {
    throw new Error("Two icons would get the same name");
  }
  const owners = iconNameOwners();
  const taken = updates.find(({ node, name }) => isOwnedByAnother(owners, name, node));
  if (taken) throw new Error(`"${taken.name}" is already used in this file`);
  for (const { node, name } of updates) node.name = name;
  figma.commitUndo();
  await publishRenameIdeas(updates.length);
}

// Audit issues can point at frames of any size, so look through every top-level node.
function selectIcon(id: unknown): void {
  const node = figma.currentPage.children.find((child) => child.id === id);
  if (!node) throw new Error("That icon is no longer on this page");
  figma.currentPage.selection = [node];
  figma.viewport.scrollAndZoomIntoView([node]);
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

// Outline artwork is 2 px round strokes with no fill; solid artwork is filled
// shapes with no stroke, so a solid page is audited for fills instead.
function auditIcon(icon: FrameNode | ComponentNode | InstanceNode, style: IconStyle = "outline"): IconAuditResult {
  const violations = new Set<string>();
  let renamed = 0;
  let rounded = 0;
  const deprecatedReplacement = getDeprecatedLucideReplacement(icon.name);
  const slug = resolveLucideIconName(icon.name);
  if (deprecatedReplacement) {
    violations.add(`Deprecated Lucide name; use "${deprecatedReplacement}"`);
  } else {
    addViolation(violations, !slug || !allowedIconNames.has(slug), "Name is not in Lucide");
  }
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
  addViolation(violations, artwork.length === 0, style === "solid" ? "No fill artwork" : "No stroke artwork");

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
    if (style === "solid") {
      const hasFill = hasVisiblePaint(node.fills);
      if (hasFill && node.name !== "Vector") {
        node.name = "Vector";
        renamed += 1;
      }
      addViolation(violations, hasVisiblePaint(node.strokes), "Solid artwork must have no stroke");
      addViolation(violations, !hasFill, "Solid artwork must use fills");
      continue;
    }
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
        ? { id: icon.id, name: icon.name, violations: [...violations] }
        : null,
    renamed,
    rounded,
  };
}

function auditIcons(): void {
  const icons = figma.currentPage.children.filter(isIconContainer);
  if (icons.length === 0) throw new Error("No icon frames on this page");
  const style = pageStyle(figma.currentPage);
  const results = icons.map((icon) => auditIcon(icon, style));
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
    } else if (request.type === "sync-library") {
      syncIconLibrary();
    } else if (request.type === "set-count") {
      await saveSettings({ batchSize: parseBatchSize(request.count) });
      publishCatalog();
    } else if (request.type === "set-columns") {
      await saveSettings({ columns: parseColumns(request.columns) });
    } else if (request.type === "set-tab") {
      if (!isTab(request.tab)) throw new Error("Unknown tab");
      await saveSettings({ tab: request.tab });
    } else if (request.type === "generate") {
      generateFrames(request.count);
    } else if (request.type === "arrange") {
      await arrangeIcons(request.columns ?? settings.columns);
    } else if (request.type === "replace") {
      await replaceIcons(request.files);
    } else if (request.type === "suggest-names") {
      await publishRenameIdeas();
    } else if (request.type === "rename") {
      await renameIcons(request.renames);
    } else if (request.type === "select") {
      selectIcon(request.id);
    } else if (request.type === "audit") {
      auditIcons();
    } else if (request.type === "check-remote") {
      await checkRemote(request.source);
    } else if (request.type === "add-remote") {
      await addRemote(request.source);
    } else {
      post({ type: "error", message: "Unsupported plugin action" });
    }
  } catch (error) {
    post({ type: "error", message: messageFromError(error) });
  }
};

figma.on("currentpagechange", () => {
  publishPageStatus();
  if (scannedStyle !== null && pageStyle(figma.currentPage) !== scannedStyle) {
    refreshCatalog().catch((error: unknown) => post({ type: "error", message: messageFromError(error) }));
  }
});

async function start(): Promise<void> {
  settings = await loadSettings();
  post({ type: "settings", settings });
  publishPageStatus();
  await refreshCatalog();
}

start().catch((error: unknown) => {
  post({ type: "error", message: messageFromError(error) });
});
