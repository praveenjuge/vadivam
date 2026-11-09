import iconCatalog from "vadivam:catalog";
import { canvasSize, pascalCase } from "../../../scripts/icon-styles.mjs";
import { messageFromError, postToUi } from "../../figma-shared/channel";
import {
  catalogSvg,
  createIconComponent,
  describeIconComponent,
  documentationLink,
  iconStyles,
  svgExportSettings,
  swapArtwork,
  type CatalogIcon,
  type IconStyle,
} from "../../figma-shared/icons";
import { layerNameKey } from "../../figma-shared/names";
import { getBatchPositions, getGridPositions, LIBRARY_COLUMNS, type IconPosition } from "./layout";
import { lucideIconNames, lucideNames, lucideVersion, rankedLucideIcons, type LucideIconRanking } from "./lucide";
import {
  MAX_SVG_FILES,
  MAX_SVG_LENGTH,
  type IconAuditIssue,
  type PluginToUiMessage,
  type RenameSuggestion,
  type ReplacedIcon,
  type SkippedSvg,
  type SvgFile,
  type UiToPluginMessage,
} from "./protocol";
import { isRemoteSource, loadRemoteCatalog, type RemoteCatalog, type RemoteSource } from "./remote";
import { suggestRenameIdeas } from "./rename";
import { clampCount, COUNT_LIMITS, DEFAULT_SETTINGS, isTab, type CountSetting, type PluginSettings } from "./settings";

const UI_WIDTH = 420;
const UI_HEIGHT = 600;
const SETTINGS_KEY = "settings";
const LIBRARY_GAP = 24;
const LIBRARY_PADDING = 24;
const LIBRARY_NAME = "Vadivam Icons";
const LIBRARY_DATA_KEY = "vadivam-internal";
const LIBRARY_SCHEMA = 1;
// The manifest's relaunch button; Figma starts the plugin with it as figma.command.
const SYNC_COMMAND = "sync-library";
const allowedIconNames = new Set(lucideIconNames);

let settings: PluginSettings = DEFAULT_SETTINGS;
// The last catalog read from GitHub or npm, reused when its icons are added.
let remoteCatalog: RemoteCatalog | null = null;
// Ranked Lucide icons with no frame yet, most popular first.
let candidates: readonly LucideIconRanking[] = [];
// The style the catalog was last scanned for; the drawn icons change when the
// current page moves to the other style.
let scannedStyle: IconStyle | null = null;

figma.showUI(__html__, { width: UI_WIDTH, height: UI_HEIGHT, themeColors: true });

const post: (message: PluginToUiMessage) => void = postToUi;

function pluginData(value: Record<string, unknown>): string {
  return JSON.stringify({ schema: LIBRARY_SCHEMA, ...value });
}

// Plugin data is private to this plugin, so it is always JSON this plugin wrote.
function readPluginData(node: BaseNode): Record<string, unknown> | null {
  const value = node.getPluginData(LIBRARY_DATA_KEY);
  if (!value) return null;
  const parsed = JSON.parse(value) as Record<string, unknown>;
  return parsed.schema === LIBRARY_SCHEMA ? parsed : null;
}

function isLibrarySet(node: BaseNode): node is ComponentSetNode {
  return node.type === "COMPONENT_SET" && readPluginData(node)?.kind === "library";
}

function librarySetsOnPage(): ComponentSetNode[] {
  return figma.currentPage.findAll((node) => node.type === "COMPONENT_SET").filter(isLibrarySet);
}

function requireCount(setting: CountSetting, value: unknown): number {
  const count = clampCount(setting, value);
  if (count === null) throw new Error(`${COUNT_LIMITS[setting].label} must be a whole number`);
  return count;
}

async function loadSettings(): Promise<PluginSettings> {
  let stored: Partial<Record<keyof PluginSettings, unknown>> = {};
  try {
    stored = (await figma.clientStorage.getAsync(SETTINGS_KEY)) ?? {};
  } catch {
    // Settings are a convenience, so unreadable storage must not keep the plugin from opening.
  }
  return {
    batchSize: clampCount("batchSize", stored.batchSize) ?? DEFAULT_SETTINGS.batchSize,
    columns: clampCount("columns", stored.columns) ?? DEFAULT_SETTINGS.columns,
    tab: isTab(stored.tab) ? stored.tab : DEFAULT_SETTINGS.tab,
  };
}

async function saveSettings(next: Partial<PluginSettings>): Promise<void> {
  settings = { ...settings, ...next };
  await figma.clientStorage.setAsync(SETTINGS_KEY, settings);
}

type IconContainer = FrameNode | ComponentNode | InstanceNode;

// Solid icons live on their own page, one whose name contains "Solid", with
// frames named like their outline twins. Names, missing icons, and the audit
// are scoped to the pages of the current page's style.
function pageStyle(page: PageNode): IconStyle {
  return /\bsolid\b/i.test(page.name) ? "solid" : "outline";
}

declare const loaded: unique symbol;
/** The current style's pages, once their content is loaded; only `loadStylePages` makes one. */
type LoadedPages = readonly PageNode[] & { readonly [loaded]: true };

async function loadStylePages(): Promise<LoadedPages> {
  await figma.loadAllPagesAsync();
  const style = pageStyle(figma.currentPage);
  return figma.root.children.filter((page) => pageStyle(page) === style) as unknown as LoadedPages;
}

function isIconContainer(node: SceneNode): node is IconContainer {
  return node.type === "FRAME" || node.type === "COMPONENT" || node.type === "INSTANCE";
}

function isIconSized(node: SceneNode): boolean {
  return Math.abs(node.width - canvasSize) < 0.01 && Math.abs(node.height - canvasSize) < 0.01;
}

function isIconFrame(node: SceneNode): node is IconContainer {
  return isIconContainer(node) && isIconSized(node);
}

// Top-level 24×24 icon frames on this page, whether or not their names are current.
function pageIconFrames(): IconContainer[] {
  return figma.currentPage.children.filter(isIconFrame);
}

/** The icon a frame or file name means: its Lucide icon, or else its kebab-case name. */
function iconKey(name: string): string {
  return lucideNames.icon(name) ?? layerNameKey(name);
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

// Icon frames on the style's pages, by the icon each one is. Synchronous, so
// callers can check and then edit without another message running in between.
function iconFramesByName(pages: LoadedPages): Map<string, IconContainer[]> {
  const frames = new Map<string, IconContainer[]>();
  for (const page of pages) {
    for (const node of page.children) {
      if (!isIconFrame(node)) continue;
      const key = iconKey(node.name);
      frames.set(key, [...(frames.get(key) ?? []), node]);
    }
  }
  return frames;
}

function isOwnedByAnother(frames: ReadonlyMap<string, SceneNode[]>, name: string, node: SceneNode): boolean {
  return (frames.get(name) ?? []).some((owner) => owner !== node);
}

function postCatalog(): void {
  post({
    type: "catalog",
    progress: { lucideVersion, drawn: rankedLucideIcons.length - candidates.length, remaining: candidates.length },
    candidates: candidates.slice(0, settings.batchSize),
  });
}

// Recounts the drawn icons after anything that adds or renames frames.
function publishCatalog(pages: LoadedPages): void {
  const drawn = iconFramesByName(pages);
  candidates = rankedLucideIcons.filter((icon) => !drawn.has(icon.name));
  postCatalog();
  publishPageStatus();
}

async function refreshCatalog(): Promise<void> {
  post({ type: "loading" });
  scannedStyle = pageStyle(figma.currentPage);
  publishCatalog(await loadStylePages());
}

function createIconFrame(name: string, position: IconPosition): FrameNode {
  const frame = figma.createFrame();
  frame.name = name;
  frame.resize(canvasSize, canvasSize);
  frame.x = position.x;
  frame.y = position.y;
  frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 }, opacity: 1, visible: true }];
  frame.strokes = [];
  frame.strokeWeight = 0.5;
  frame.clipsContent = false;
  frame.layoutGrids = [{ pattern: "GRID", sectionSize: 2, visible: true, color: { r: 1, g: 0, b: 0, a: 0.1 } }];
  frame.exportSettings = [svgExportSettings];
  return frame;
}

interface LibraryTag {
  name: string;
  style: IconStyle;
}

// Components tagged before solid icons existed have no style and are outline.
function libraryTag(node: ComponentNode): LibraryTag | null {
  const data = readPluginData(node);
  if (data?.kind !== "icon" || typeof data.name !== "string") return null;
  return { name: data.name, style: data.style === "solid" ? "solid" : "outline" };
}

function tagLibraryComponent(component: ComponentNode, icon: CatalogIcon, style: IconStyle): void {
  component.name = `Icon=${icon.name}, Style=${pascalCase(style)}`;
  component.resizeWithoutConstraints(canvasSize, canvasSize);
  component.setPluginData(LIBRARY_DATA_KEY, pluginData({ kind: "icon", name: icon.name, style }));
  component.setRelaunchData({ [SYNC_COMMAND]: "Update all icons" });
  describeIconComponent(component, icon, style);
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
  componentSet.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  componentSet.strokes = [];
  componentSet.cornerRadius = 0;
  componentSet.clipsContent = false;
  const width = LIBRARY_COLUMNS * canvasSize + (LIBRARY_COLUMNS - 1) * LIBRARY_GAP + LIBRARY_PADDING * 2;
  componentSet.resizeWithoutConstraints(width, Math.max(componentSet.height, canvasSize));
  componentSet.setPluginData(LIBRARY_DATA_KEY, pluginData({ kind: "library", columns: LIBRARY_COLUMNS }));
  componentSet.setRelaunchData({ [SYNC_COMMAND]: "Update all icons" });
  componentSet.descriptionMarkdown = `${iconCatalog.length} open-source icons on a 24 px grid, each in an outline and a solid style. Pick an icon with the **Icon** property and a style with **Style**, then change the color as needed.`;
  componentSet.documentationLinks = [documentationLink()];
}

function createLibraryComponent(icon: CatalogIcon, style: IconStyle): ComponentNode {
  return createIconComponent(icon, style, (component) => tagLibraryComponent(component, icon, style));
}

// Swaps a node's layers for a 24×24 SVG's layers; the node itself and its settings stay.
function replaceArtwork(target: FrameNode | ComponentNode, svg: string): void {
  const source = figma.createNodeFromSvg(svg);
  if (!isIconSized(source)) {
    source.remove();
    throw new Error("SVG must be 24×24");
  }
  swapArtwork(target, source);
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
  if (sets.length > 1) throw new Error("Select the Vadivam icon library you want to update");
  return sets[0] ?? null;
}

function createIconLibrary(): ComponentSetNode {
  const variants = iconCatalog.flatMap((icon) => iconStyles.map((style) => ({ icon, style })));
  const components: ComponentNode[] = [];
  let componentSet: ComponentSetNode | null = null;
  try {
    for (const { icon, style } of variants) components.push(createLibraryComponent(icon, style));
    componentSet = figma.combineAsVariants(components, figma.currentPage);
    variants.forEach(({ icon, style }, index) => tagLibraryComponent(components[index]!, icon, style));
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

function updateIconLibrary(componentSet: ComponentSetNode): { added: number; retained: number } {
  // Keyed by icon and style; existing outline components keep their identity
  // and gain the Style property, and each solid variant is added beside them.
  const existing = new Map<string, ComponentNode>();
  for (const child of componentSet.children) {
    if (child.type !== "COMPONENT") continue;
    const tag = libraryTag(child);
    const key = tag && `${tag.name}:${tag.style}`;
    if (key && !existing.has(key)) existing.set(key, child);
  }

  let added = 0;
  const canonicalComponents: ComponentNode[] = [];
  for (const icon of iconCatalog) {
    for (const style of iconStyles) {
      let component = existing.get(`${icon.name}:${style}`);
      if (component) {
        replaceArtwork(component, catalogSvg(icon, style));
        tagLibraryComponent(component, icon, style);
      } else {
        component = createLibraryComponent(icon, style);
        componentSet.appendChild(component);
        added += 1;
      }
      canonicalComponents.push(component);
    }
  }
  canonicalComponents.forEach((component, index) => componentSet.insertChild(index, component));
  configureLibrarySet(componentSet);
  return { added, retained: Math.max(0, componentSet.children.length - canonicalComponents.length) };
}

function syncIconLibrary(): void {
  const existing = librarySetForUpdate();
  const componentSet = existing ?? createIconLibrary();
  const result = existing ? updateIconLibrary(existing) : { added: iconCatalog.length * iconStyles.length, retained: 0 };
  figma.currentPage.selection = [componentSet];
  figma.viewport.scrollAndZoomIntoView([componentSet]);
  figma.commitUndo();
  publishPageStatus();
  post({ type: "library-synced", count: iconCatalog.length, created: existing === null, ...result });
}

function requireRemoteSource(value: unknown): RemoteSource {
  if (!isRemoteSource(value)) throw new Error("Choose GitHub or npm");
  return value;
}

async function readRemoteCatalog(source: RemoteSource, reuse: boolean): Promise<RemoteCatalog> {
  const style = pageStyle(figma.currentPage);
  if (reuse && remoteCatalog?.source === source && remoteCatalog.style === style) return remoteCatalog;
  remoteCatalog = await loadRemoteCatalog(source, fetch, style);
  return remoteCatalog;
}

// Every name an icon frame of this style answers to, in any spelling, so
// "ArrowRight", "arrow_right", and a deprecated alias all count as that icon.
function fileIconNames(pages: LoadedPages): Set<string> {
  const names = new Set(iconFramesByName(pages).keys());
  for (const page of pages) {
    for (const node of page.children) if (isIconFrame(node)) names.add(layerNameKey(node.name));
  }
  return names;
}

// Lists icons on GitHub main or npm latest that no icon frame in this file has yet.
async function checkRemote(sourceValue: unknown): Promise<void> {
  const source = requireRemoteSource(sourceValue);
  const remote = await readRemoteCatalog(source, false);
  const present = fileIconNames(await loadStylePages());
  post({ type: "remote-checked", source, version: remote.version, missing: remote.names.filter((name) => !present.has(name)) });
}

// Adds a frame on this page for every icon from the checked source that the file
// lacks, then sorts the page A–Z like Replace, as one undo step. Existing frames
// keep their artwork, so edits made in Figma are never overwritten.
async function addRemote(sourceValue: unknown): Promise<void> {
  const source = requireRemoteSource(sourceValue);
  // The artwork downloaded is for this page's style, so it lands only here.
  const page = figma.currentPage;
  const remote = await readRemoteCatalog(source, true);
  const pages = await loadStylePages();
  const before = fileIconNames(pages);
  const { icons, failed } = await remote.loadSvgs(remote.names.filter((name) => !before.has(name)));
  if (figma.currentPage !== page) {
    throw new Error(`The page changed while icons downloaded; go back to ${page.name} and add them again`);
  }

  const added: string[] = [];
  const frames: FrameNode[] = [];
  // Read again after the downloads; the file may have changed meanwhile.
  const present = fileIconNames(pages);
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
    publishCatalog(pages);
    figma.currentPage.selection = frames;
    figma.viewport.scrollAndZoomIntoView(frames);
    figma.commitUndo();
  }
  publishPageStatus();
  post({ type: "remote-added", version: remote.version, added, failed });
}

async function generateFrames(countValue: unknown): Promise<void> {
  const count = requireCount("batchSize", countValue);
  const page = figma.currentPage;
  const pages = await loadStylePages();
  if (figma.currentPage !== page) {
    throw new Error(`The page changed while pages loaded; go back to ${page.name} and generate again`);
  }
  // Picked after the load, so the missing icons reflect this page as it is now.
  const selected = candidates.slice(0, count);
  if (selected.length === 0) throw new Error("No missing ranked icons remain");
  const names = selected.map((icon) => icon.name);
  const positions = getBatchPositions(
    names.length,
    settings.columns,
    pageIconFrames().filter((node) => lucideNames.icon(node.name) !== null),
    figma.viewport.center,
  );
  const frames = names.map((name, index) => createIconFrame(name, positions[index]!));
  figma.currentPage.selection = frames;
  figma.viewport.scrollAndZoomIntoView(frames);
  publishCatalog(pages);
  post({ type: "generated", names });
}

// Sorts this page's icon frames A–Z into a grid that starts at their top-left corner.
function layOutIconFrames(columns: number): IconContainer[] {
  // By the name as spelled, so a deprecated name sorts where it reads until it is renamed.
  const sortKey = (node: SceneNode) => lucideNames.current(node.name) ?? layerNameKey(node.name);
  const icons = pageIconFrames().sort((left, right) => sortKey(left).localeCompare(sortKey(right)));
  if (icons.length === 0) return icons;
  const origin = { x: Math.min(...icons.map((node) => node.x)), y: Math.min(...icons.map((node) => node.y)) };
  getGridPositions(icons.length, columns, origin).forEach((position, index) => {
    icons[index]!.x = position.x;
    icons[index]!.y = position.y;
  });
  return icons;
}

async function arrangeIcons(columnsValue: unknown): Promise<void> {
  const columns = requireCount("columns", columnsValue);
  if (columns !== settings.columns) await saveSettings({ columns });
  const icons = layOutIconFrames(columns);
  if (icons.length === 0) throw new Error("No icon frames on this page");
  figma.currentPage.selection = icons;
  figma.viewport.scrollAndZoomIntoView(icons);
  figma.commitUndo();
  post({ type: "arranged", count: icons.length, columns, rows: Math.ceil(icons.length / columns) });
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
  const [position] = getBatchPositions(1, settings.columns, pageIconFrames(), figma.viewport.center);
  const frame = createIconFrame(name, position!);
  try {
    replaceArtwork(frame, svg);
  } catch (error) {
    frame.remove();
    throw error;
  }
  return frame;
}

// Each file replaces the artwork of the 24×24 frames on this page for the same
// icon; "ArrowRight.svg", "arrow_right.svg", and "arrow-right.svg" all match
// "arrow-right". Files with no frame get a new one, and the page is sorted A–Z
// so it lands in place.
async function replaceIcons(filesValue: unknown): Promise<void> {
  const files = parseSvgFiles(filesValue);
  const pages = await loadStylePages();
  const owners = iconFramesByName(pages);
  const replaced: ReplacedIcon[] = [];
  const added: ReplacedIcon[] = [];
  const skipped: SkippedSvg[] = [];
  const used = new Set<string>();
  for (const file of files) {
    const name = iconKey(file.name.replace(/\.svg$/i, ""));
    if (!name) {
      skipped.push({ file: file.name, reason: "File name is not an icon name" });
      continue;
    }
    if (used.has(name)) {
      skipped.push({ file: file.name, reason: "Another file has the same icon name" });
      continue;
    }
    used.add(name);
    const frames = owners.get(name) ?? [];
    const targets = frames.filter((frame) => frame.parent === figma.currentPage);
    if (targets.length === 0 && frames[0]) {
      skipped.push({ file: file.name, reason: `"${name}" is on the "${frames[0].parent?.name ?? "another"}" page` });
      continue;
    }
    if (targets.length === 0) {
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
    publishCatalog(pages);
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

function publishRenameIdeas(pages: LoadedPages, renamed: number): void {
  const frames = pageIconFrames();
  if (frames.length === 0) throw new Error("No icon frames on this page");
  const owners = iconFramesByName(pages);
  const icons: RenameSuggestion[] = frames
    .filter((node) => !allowedIconNames.has(node.name))
    .map((node) => ({
      id: node.id,
      name: node.name,
      ideas: suggestRenameIdeas(node.name).map((idea) => ({ ...idea, taken: isOwnedByAnother(owners, idea.name, node) })),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  publishCatalog(pages);
  post({ type: "rename-ideas", icons, renamed });
}

async function renameIcons(renames: unknown): Promise<void> {
  if (!Array.isArray(renames) || renames.length === 0 || renames.length > 10_000) {
    throw new Error("Invalid rename request");
  }
  const pages = await loadStylePages();
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
  const owners = iconFramesByName(pages);
  const taken = updates.find(({ node, name }) => isOwnedByAnother(owners, name, node));
  if (taken) throw new Error(`"${taken.name}" is already used in this file`);
  for (const { node, name } of updates) node.name = name;
  figma.commitUndo();
  publishRenameIdeas(pages, updates.length);
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
    paints.some((paint) => paint.visible !== false && (paint.opacity === undefined || paint.opacity > 0))
  );
}

function nameViolation(name: string): string | null {
  if (allowedIconNames.has(name)) return null;
  const replacement = lucideNames.replacement(name);
  if (replacement) return `Deprecated Lucide name; use "${replacement}"`;
  const current = lucideNames.current(name);
  // The frame's name becomes the exported file's name, which must be the exact Lucide name.
  return current ? `Name must be "${current}"` : "Name is not in Lucide";
}

interface IconAuditResult {
  issue: IconAuditIssue | null;
  renamed: number;
  rounded: number;
}

// Outline artwork is 2 px round strokes with no fill; solid artwork is filled
// shapes with no stroke, so a solid page is audited for fills instead.
function auditIcon(icon: IconContainer, style: IconStyle): IconAuditResult {
  const violations = new Set<string>();
  const check = (failed: boolean, message: string) => {
    if (failed) violations.add(message);
  };
  let renamed = 0;
  let rounded = 0;
  const name = nameViolation(icon.name);
  if (name) violations.add(name);
  check(!isIconSized(icon), "Frame must be 24×24");
  check(Math.abs(icon.rotation) >= 0.01, "Rotation must be 0°");
  check(hasVisiblePaint(icon.fills), "Frame must have no background fill");
  check(icon.layoutGrids.length > 0, "Frame must have no layout guides");
  if ("cornerRadius" in icon) check(icon.cornerRadius !== 0, "Corner radius must be 0");

  const descendants = icon.findAll(() => true);
  const artwork = descendants.filter(
    (node): node is SceneNode & GeometryMixin => "fills" in node && "strokes" in node && "strokeCap" in node,
  );
  check(artwork.length === 0, style === "solid" ? "No fill artwork" : "No stroke artwork");

  for (const node of descendants) {
    if ("rotation" in node) check(Math.abs(node.rotation) >= 0.01, "Artwork rotation must be 0°");
    if ("cornerRadius" in node) check(node.cornerRadius !== 0, "Artwork corner radius must be 0");
  }

  for (const node of artwork) {
    const painted = hasVisiblePaint(style === "solid" ? node.fills : node.strokes);
    if (painted && node.name !== "Vector") {
      node.name = "Vector";
      renamed += 1;
    }
    if (style === "solid") {
      check(hasVisiblePaint(node.strokes), "Solid artwork must have no stroke");
      check(!painted, "Solid artwork must use fills");
      continue;
    }
    if (painted && node.strokeCap !== "ROUND") {
      node.strokeCap = "ROUND";
      rounded += 1;
    }
    check(hasVisiblePaint(node.fills), "Artwork must have no fill");
    check(!painted, "Artwork must use strokes");
    check(node.strokeWeight === figma.mixed || Math.abs(node.strokeWeight - 2) >= 0.01, "Stroke weight must be 2 px");
    check(node.strokeJoin !== "ROUND", "Stroke joins must be round");
  }

  return {
    issue: violations.size > 0 ? { id: icon.id, name: icon.name, violations: [...violations] } : null,
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

async function handle(request: UiToPluginMessage): Promise<void> {
  switch (request.type) {
    case "refresh":
      return refreshCatalog();
    case "sync-library":
      return syncIconLibrary();
    case "set-count":
      await saveSettings({ batchSize: requireCount("batchSize", request.count) });
      return postCatalog();
    case "set-columns":
      return saveSettings({ columns: requireCount("columns", request.columns) });
    case "set-tab":
      if (!isTab(request.tab)) throw new Error("Unknown tab");
      return saveSettings({ tab: request.tab });
    case "generate":
      return generateFrames(request.count);
    case "arrange":
      return arrangeIcons(request.columns);
    case "replace":
      return replaceIcons(request.files);
    case "suggest-names":
      return publishRenameIdeas(await loadStylePages(), 0);
    case "rename":
      return renameIcons(request.renames);
    case "select":
      return selectIcon(request.id);
    case "audit":
      return auditIcons();
    case "check-remote":
      return checkRemote(request.source);
    case "add-remote":
      return addRemote(request.source);
    default:
      throw new Error("Unsupported plugin action");
  }
}

function reportError(error: unknown): void {
  post({ type: "error", message: messageFromError(error) });
}

figma.ui.onmessage = async (message: unknown): Promise<void> => {
  if (!message || typeof message !== "object" || !("type" in message)) {
    reportError(new Error("Invalid plugin message"));
    return;
  }
  try {
    await handle(message as UiToPluginMessage);
  } catch (error) {
    reportError(error);
  }
};

figma.on("currentpagechange", () => {
  publishPageStatus();
  if (scannedStyle !== null && pageStyle(figma.currentPage) !== scannedStyle) refreshCatalog().catch(reportError);
});

async function start(): Promise<void> {
  settings = await loadSettings();
  post({ type: "settings", settings });
  publishPageStatus();
  await refreshCatalog();
  if (figma.command === SYNC_COMMAND) syncIconLibrary();
}

start().catch(reportError);
