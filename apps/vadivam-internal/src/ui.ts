import {
  EXACT_RENAME_REASONS,
  MAX_SVG_FILES,
  MAX_SVG_LENGTH,
  TABS,
  type CatalogSummary,
  type IconAuditIssue,
  type IconAuditSummary,
  type PageStatus,
  type PluginSettings,
  type PluginToUiMessage,
  type RenameReason,
  type RenameSuggestion,
  type ReplacedIcon,
  type SkippedSvg,
  type Tab,
  type UiToPluginMessage,
} from "./protocol";
import type { LucideIconRanking } from "./catalog";
import { MAX_BATCH_SIZE } from "./catalog";
import { MAX_COLUMNS } from "./layout";

type Tone = "idle" | "busy" | "success" | "error";

function element<T extends Element>(selector: string): T {
  const match = document.querySelector<T>(selector);
  if (!match) throw new Error(`Missing UI element: ${selector}`);
  return match;
}

const progressLabel = element<HTMLParagraphElement>("#progress-label");
const progressBar = element<HTMLSpanElement>("#progress-bar");
const refreshButton = element<HTMLButtonElement>("#refresh");
const tabs = [...document.querySelectorAll<HTMLButtonElement>("[role=tab]")];
const countInput = element<HTMLInputElement>("#count");
const generateButton = element<HTMLButtonElement>("#generate");
const createResults = element<HTMLOListElement>("#create-results");
const chooseSvgsButton = element<HTMLButtonElement>("#choose-svgs");
const svgFilesInput = element<HTMLInputElement>("#svg-files");
const replaceMeta = element<HTMLSpanElement>("#replace-meta");
const replaceResults = element<HTMLOListElement>("#replace-results");
const columnsInput = element<HTMLInputElement>("#columns");
const presetButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-columns]")];
const arrangeSummary = element<HTMLSpanElement>("#arrange-summary");
const arrangePage = element<HTMLSpanElement>("#arrange-page");
const preview = element<HTMLDivElement>("#preview");
const previewMore = element<HTMLParagraphElement>("#preview-more");
const arrangeButton = element<HTMLButtonElement>("#arrange");
const suggestButton = element<HTMLButtonElement>("#suggest");
const renameMeta = element<HTMLSpanElement>("#rename-meta");
const renameResults = element<HTMLOListElement>("#rename-results");
const auditButton = element<HTMLButtonElement>("#audit");
const auditStats = element<HTMLDListElement>("#audit-stats");
const auditResults = element<HTMLOListElement>("#audit-results");
const libraryCount = element<HTMLElement>("#library-count");
const libraryState = element<HTMLElement>("#library-state");
const syncLibraryButton = element<HTMLButtonElement>("#sync-library");
const status = element<HTMLElement>("#status");
const statusText = element<HTMLSpanElement>("#status-text");

const PREVIEW_MAX_HEIGHT = 140;
const PREVIEW_MAX_CELL = 24;

let candidates: LucideIconRanking[] = [];
let catalog: CatalogSummary | null = null;
let page: PageStatus | null = null;
let busy = true;

const renameReasonLabels: Record<RenameReason, string> = {
  format: "Lucide format",
  deprecated: "Renamed in Lucide",
  reordered: "Same words",
  tag: "Lucide tag",
  spelling: "Close spelling",
  similar: "Similar name",
};

const numberFormat = new Intl.NumberFormat("en");
const compactFormat = new Intl.NumberFormat("en", { notation: "compact" });

function plural(count: number, word: string, many = `${word}s`): string {
  return `${numberFormat.format(count)} ${count === 1 ? word : many}`;
}

function send(message: UiToPluginMessage): void {
  parent.postMessage({ pluginMessage: message }, "*");
}

function icon(id: "success" | "locate"): Element {
  const template = element<HTMLTemplateElement>(`#icon-${id}`);
  return template.content.firstElementChild!.cloneNode(true) as Element;
}

function setStatus(text: string, tone: Tone = "idle"): void {
  statusText.textContent = text;
  status.dataset.tone = tone;
}

function setBadge(tab: Tab, value: number | null, alert = false): void {
  const badge = document.querySelector<HTMLSpanElement>(`[data-badge="${tab}"]`);
  if (!badge) return;
  badge.textContent = value ? compactFormat.format(value) : "";
  badge.classList.toggle("alert", alert);
}

function updateActions(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-action]")) {
    button.disabled = busy;
  }
  if (!busy) {
    generateButton.disabled = candidates.length === 0;
    arrangeButton.disabled = page?.iconFrames === 0;
    syncLibraryButton.disabled = page === null;
  }
}

function startAction(text: string, message: UiToPluginMessage): void {
  busy = true;
  updateActions();
  setStatus(text, "busy");
  send(message);
}

function finishAction(text: string, tone: Tone): void {
  busy = false;
  updateActions();
  setStatus(text, tone);
}

function emptyState(text: string, success = false): HTMLLIElement {
  const item = document.createElement("li");
  item.className = success ? "empty success" : "empty";
  if (success) item.append(icon("success"));
  const label = document.createElement("span");
  label.textContent = text;
  item.append(label);
  return item;
}

function targetButton(id: string, name: string): HTMLButtonElement {
  const button = document.createElement("button");
  const label = document.createElement("span");
  button.type = "button";
  button.className = "target";
  button.title = "Select in Figma";
  label.textContent = name;
  button.append(label, icon("locate"));
  button.addEventListener("click", () => send({ type: "select", id }));
  return button;
}

// Tabs

function selectTab(tab: Tab, focus = false): void {
  for (const button of tabs) {
    const selected = button.dataset.tab === tab;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
    if (selected && focus) button.focus();
    const panel = document.getElementById(`panel-${button.dataset.tab}`);
    if (panel) panel.hidden = !selected;
  }
  if (tab === "arrange") renderPreview();
}

function isTab(value: string | undefined): value is Tab {
  return (TABS as readonly string[]).includes(value ?? "");
}

for (const button of tabs) {
  button.addEventListener("click", () => {
    const tab = button.dataset.tab;
    if (!isTab(tab)) return;
    selectTab(tab);
    send({ type: "set-tab", tab });
  });
}

element<HTMLElement>("[role=tablist]").addEventListener("keydown", (event) => {
  const current = tabs.findIndex((button) => button.getAttribute("aria-selected") === "true");
  const next =
    event.key === "ArrowRight" ? (current + 1) % tabs.length
    : event.key === "ArrowLeft" ? (current - 1 + tabs.length) % tabs.length
    : event.key === "Home" ? 0
    : event.key === "End" ? tabs.length - 1
    : -1;
  const tab = tabs[next]?.dataset.tab;
  if (next < 0 || !isTab(tab)) return;
  event.preventDefault();
  selectTab(tab, true);
  send({ type: "set-tab", tab });
});

// Number inputs

function clampInput(input: HTMLInputElement, max: number, fallback: number): number {
  const value = Number(input.value);
  const clamped = Number.isInteger(value) ? Math.min(max, Math.max(1, value)) : fallback;
  input.value = String(clamped);
  return clamped;
}

function readCount(): number {
  return clampInput(countInput, MAX_BATCH_SIZE, 20);
}

function readColumns(): number {
  return clampInput(columnsInput, MAX_COLUMNS, 40);
}

function commitCount(): void {
  const count = readCount();
  updateGenerateLabel();
  send({ type: "set-count", count });
}

function commitColumns(): void {
  send({ type: "set-columns", columns: readColumns() });
  renderPreview();
}

countInput.addEventListener("change", commitCount);
columnsInput.addEventListener("change", commitColumns);
columnsInput.addEventListener("input", () => {
  if (Number.isInteger(Number(columnsInput.value)) && Number(columnsInput.value) > 0) {
    renderPreview();
  }
});

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-step]")) {
  button.addEventListener("click", () => {
    const input = button.dataset.step === "count" ? countInput : columnsInput;
    input.value = String(Number(input.value) + Number(button.dataset.delta));
    if (input === countInput) commitCount();
    else commitColumns();
  });
}

for (const button of presetButtons) {
  button.addEventListener("click", () => {
    columnsInput.value = button.dataset.columns ?? "40";
    commitColumns();
  });
}

// Create

function updateGenerateLabel(): void {
  const count = Math.min(readCount(), candidates.length || readCount());
  generateButton.textContent = `Create ${plural(count, "frame")}`;
}

function renderCandidates(): void {
  createResults.replaceChildren();
  if (candidates.length === 0) {
    createResults.append(emptyState("Every Lucide icon has a frame in this file.", true));
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const candidate of candidates) {
    const item = document.createElement("li");
    const rank = document.createElement("span");
    const name = document.createElement("span");
    const visitors = document.createElement("span");
    item.className = "candidate";
    rank.className = "rank";
    name.className = "candidate-name";
    visitors.className = "visitors";
    rank.textContent = `#${candidate.rank}`;
    name.textContent = candidate.name;
    visitors.textContent = compactFormat.format(candidate.popularity);
    visitors.title = `${numberFormat.format(candidate.popularity)} visitors in the last 12 months`;
    item.append(rank, name, visitors);
    fragment.append(item);
  }
  createResults.append(fragment);
}

function renderProgress(): void {
  if (!catalog) return;
  const total = catalog.matchedCount + catalog.remainingCount;
  progressLabel.textContent = `Lucide ${catalog.lucideVersion} · ${numberFormat.format(catalog.matchedCount)} of ${numberFormat.format(total)} drawn`;
  progressBar.style.width = `${total === 0 ? 0 : (catalog.matchedCount / total) * 100}%`;
  setBadge("create", catalog.remainingCount);
}

// Replace

async function readSvgFiles(files: File[]): Promise<void> {
  if (files.length > MAX_SVG_FILES) {
    setStatus(`Choose up to ${numberFormat.format(MAX_SVG_FILES)} SVG files`, "error");
    return;
  }
  const tooLarge = files.find((file) => file.size > MAX_SVG_LENGTH);
  if (tooLarge) {
    setStatus(`${tooLarge.name} is too large for an icon`, "error");
    return;
  }
  busy = true;
  updateActions();
  setStatus("Reading SVGs…", "busy");
  try {
    const svgs = await Promise.all(
      files.map(async (file) => ({ name: file.name, svg: await file.text() })),
    );
    startAction(`Replacing ${plural(svgs.length, "icon")}…`, { type: "replace", files: svgs });
  } catch {
    finishAction("Couldn't read those files", "error");
  }
}

function renderReplaced(replaced: ReplacedIcon[], skipped: SkippedSvg[]): void {
  replaceResults.replaceChildren();
  setBadge("replace", skipped.length, skipped.length > 0);
  replaceMeta.textContent = [
    replaced.length > 0 ? `${plural(replaced.length, "icon")} replaced` : "",
    skipped.length > 0 ? `${numberFormat.format(skipped.length)} skipped` : "",
  ].filter(Boolean).join(" · ");

  const fragment = document.createDocumentFragment();
  for (const skip of skipped) {
    const item = document.createElement("li");
    const file = document.createElement("span");
    const reasons = document.createElement("ul");
    const reason = document.createElement("li");
    item.className = "issue";
    file.className = "candidate-name";
    reasons.className = "violations";
    file.textContent = skip.file;
    reason.textContent = skip.reason;
    reasons.append(reason);
    item.append(file, reasons);
    fragment.append(item);
  }
  for (const icon of replaced) {
    const item = document.createElement("li");
    item.className = "replaced";
    item.append(targetButton(icon.id, icon.name));
    fragment.append(item);
  }
  replaceResults.append(fragment);
}

// Arrange

function renderPreview(): void {
  const columns = Math.min(MAX_COLUMNS, Math.max(1, Math.round(Number(columnsInput.value)) || 1));
  const frames = page?.iconFrames ?? 0;
  const rows = Math.ceil(frames / columns);

  for (const button of presetButtons) {
    button.setAttribute("aria-pressed", String(Number(button.dataset.columns) === columns));
  }
  arrangePage.textContent = page ? page.name : "";
  arrangeSummary.textContent =
    frames === 0
      ? "No icon frames on this page"
      : `${plural(frames, "icon")} → ${plural(rows, "row")} of ${columns}`;
  arrangeButton.textContent =
    frames === 0 ? "Arrange icons" : `Arrange ${plural(frames, "icon")}`;

  // Cells keep the real 40×72 grid step so the preview matches the canvas shape.
  const available = Math.max(1, preview.clientWidth - 16 || document.body.clientWidth - 40);
  const cell = Math.min(PREVIEW_MAX_CELL, available / columns);
  const maxRows = Math.max(1, Math.floor(PREVIEW_MAX_HEIGHT / (cell * 1.8)));
  const shownRows = frames === 0 ? Math.min(2, maxRows) : Math.min(rows, maxRows);
  const shownCells = frames === 0 ? columns * shownRows : Math.min(frames, columns * shownRows);

  preview.style.gridTemplateColumns = `repeat(${columns}, ${cell}px)`;
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < shownCells; index += 1) {
    const dot = document.createElement("i");
    if (frames === 0) dot.className = "ghost";
    fragment.append(dot);
  }
  preview.replaceChildren(fragment);

  const hiddenRows = frames === 0 ? 0 : rows - shownRows;
  previewMore.hidden = hiddenRows <= 0;
  previewMore.textContent = `+ ${plural(hiddenRows, "more row")}`;
  updateActions();
}

// Rename

function renderRenameIdeas(icons: RenameSuggestion[]): void {
  renameResults.replaceChildren();
  setBadge("rename", icons.length, icons.length > 0);
  renameMeta.textContent = icons.length === 0 ? "" : `${plural(icons.length, "frame")} to fix`;
  if (icons.length === 0) {
    renameResults.append(emptyState("Every icon frame uses a current Lucide name.", true));
    return;
  }

  const fragment = document.createDocumentFragment();
  // Two frames can share an exact fix (alert-circle and AlertCircle); rename only the first.
  const targets = new Set<string>();
  const exact = icons.flatMap((suggestion) => {
    // Exact ideas are always returned alone, so this is the frame's first idea.
    const idea = suggestion.ideas.find((candidate) => EXACT_RENAME_REASONS.has(candidate.reason));
    if (!idea || idea.taken || targets.has(idea.name)) return [];
    targets.add(idea.name);
    return [{ id: suggestion.id, name: idea.name }];
  });
  if (exact.length > 0) {
    const item = document.createElement("li");
    const label = document.createElement("span");
    const button = document.createElement("button");
    item.className = "bulk";
    label.textContent = `${plural(exact.length, "exact fix", "exact fixes")} ready`;
    button.type = "button";
    button.className = "secondary";
    button.dataset.action = "";
    button.textContent = "Rename all";
    button.addEventListener("click", () => renameTo(exact));
    item.append(label, button);
    fragment.append(item);
  }

  for (const suggestion of icons) {
    const item = document.createElement("li");
    const ideas = document.createElement("div");
    item.className = "suggestion";
    ideas.className = "ideas";
    item.append(targetButton(suggestion.id, suggestion.name), ideas);
    if (suggestion.ideas.length === 0) {
      const none = document.createElement("span");
      none.className = "idea-reason";
      none.textContent = "No close Lucide match";
      ideas.append(none);
    }
    for (const idea of suggestion.ideas) {
      const button = document.createElement("button");
      const name = document.createElement("span");
      const reason = document.createElement("span");
      button.type = "button";
      button.className = EXACT_RENAME_REASONS.has(idea.reason) ? "idea exact" : "idea";
      button.title = idea.taken
        ? `${idea.name} is already used in this file`
        : `Rename to ${idea.name}`;
      button.disabled = idea.taken;
      name.className = "idea-name";
      reason.className = "idea-reason";
      name.textContent = idea.name;
      reason.textContent = idea.taken ? "Already in file" : renameReasonLabels[idea.reason];
      button.append(name, reason);
      button.addEventListener("click", () => renameTo([{ id: suggestion.id, name: idea.name }]));
      ideas.append(button);
    }
    fragment.append(item);
  }
  renameResults.append(fragment);
}

function renameTo(renames: Array<{ id: string; name: string }>): void {
  startAction(`Renaming ${plural(renames.length, "icon")}…`, { type: "rename", renames });
}

// Audit

function renderAudit(summary: IconAuditSummary, issues: IconAuditIssue[]): void {
  const fixed = summary.renamed + summary.rounded;
  const values: Record<string, number> = { ...summary, fixed };
  for (const stat of auditStats.querySelectorAll<HTMLElement>("[data-stat]")) {
    stat.textContent = numberFormat.format(values[stat.dataset.stat ?? ""] ?? 0);
  }
  auditStats.querySelector("[data-stat=failed]")?.classList.toggle("alert", summary.failed > 0);
  auditStats.querySelector("[data-stat=fixed]")?.setAttribute(
    "title",
    `${plural(summary.renamed, "layer")} renamed · ${plural(summary.rounded, "cap")} rounded`,
  );
  auditStats.hidden = false;
  setBadge("audit", issues.length, issues.length > 0);

  auditResults.replaceChildren();
  if (issues.length === 0) {
    auditResults.append(emptyState("Every icon passed all checks.", true));
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const issue of issues) {
    const item = document.createElement("li");
    const violations = document.createElement("ul");
    item.className = "issue";
    violations.className = "violations";
    for (const violation of issue.violations) {
      const line = document.createElement("li");
      line.textContent = violation;
      violations.append(line);
    }
    item.append(targetButton(issue.id, issue.name), violations);
    fragment.append(item);
  }
  auditResults.append(fragment);
}

// Library

function renderLibrary(): void {
  if (!page) return;
  libraryCount.textContent = numberFormat.format(page.libraryIcons);
  libraryState.textContent = page.hasLibrary ? "Found" : "Not yet";
  syncLibraryButton.textContent = page.hasLibrary ? "Update library" : "Create library";
}

// Actions

refreshButton.addEventListener("click", () => {
  startAction("Scanning every page…", { type: "refresh" });
});
generateButton.addEventListener("click", () => {
  startAction("Creating frames…", { type: "generate", count: readCount() });
});
arrangeButton.addEventListener("click", () => {
  startAction("Arranging icons A–Z…", { type: "arrange", columns: readColumns() });
});
chooseSvgsButton.addEventListener("click", () => svgFilesInput.click());
svgFilesInput.addEventListener("change", () => {
  const files = [...(svgFilesInput.files ?? [])];
  // Clear the input so choosing the same files again still fires a change.
  svgFilesInput.value = "";
  if (files.length > 0) void readSvgFiles(files);
});
suggestButton.addEventListener("click", () => {
  startAction("Checking names…", { type: "suggest-names" });
});
auditButton.addEventListener("click", () => {
  startAction("Auditing icons…", { type: "audit" });
});
syncLibraryButton.addEventListener("click", () => {
  startAction(
    page?.hasLibrary ? "Updating the component library…" : "Creating the component library…",
    { type: "sync-library" },
  );
});

function applySettings(settings: PluginSettings): void {
  countInput.value = String(settings.batchSize);
  columnsInput.value = String(settings.columns);
  updateGenerateLabel();
  selectTab(settings.tab);
}

window.onmessage = (event: MessageEvent<{ pluginMessage?: PluginToUiMessage }>) => {
  const message = event.data.pluginMessage;
  if (!message) return;

  switch (message.type) {
    case "settings":
      applySettings(message.settings);
      return;
    case "page":
      page = message.page;
      renderPreview();
      renderLibrary();
      return;
    case "loading":
      busy = true;
      updateActions();
      setStatus("Scanning every page…", "busy");
      return;
    case "catalog": {
      candidates = message.candidates;
      catalog = message.summary;
      renderProgress();
      renderCandidates();
      updateGenerateLabel();
      const left = catalog.remainingCount;
      finishAction(
        left === 0
          ? `All ${numberFormat.format(catalog.matchedCount)} Lucide icons are drawn`
          : `${plural(left, "Lucide icon")} left to draw`,
        "idle",
      );
      return;
    }
    case "generated":
      finishAction(`Created ${plural(message.names.length, "frame")} on this page`, "success");
      return;
    case "arranged":
      finishAction(
        `Arranged ${plural(message.count, "icon")} into ${plural(message.rows, "row")} of ${message.columns}`,
        "success",
      );
      return;
    case "replaced": {
      renderReplaced(message.replaced, message.skipped);
      const done = message.replaced.length;
      const skipped = message.skipped.length;
      finishAction(
        done === 0
          ? `Nothing replaced · ${plural(skipped, "file")} skipped`
          : `Replaced ${plural(done, "icon")}${skipped > 0 ? ` · ${numberFormat.format(skipped)} skipped` : ""}`,
        done === 0 ? "error" : "success",
      );
      return;
    }
    case "rename-ideas": {
      renderRenameIdeas(message.icons);
      const left = message.icons.length;
      const remaining = left === 0 ? "every name is current" : `${plural(left, "frame")} to fix`;
      const renamed = message.renamed > 0 ? `Renamed ${plural(message.renamed, "icon")} · ` : "";
      finishAction(
        renamed ? `${renamed}${remaining}` : remaining.replace(/^e/, "E"),
        left === 0 ? "success" : "idle",
      );
      return;
    }
    case "audit": {
      const { summary } = message;
      renderAudit(summary, message.issues);
      finishAction(
        summary.failed === 0
          ? `All ${plural(summary.checked, "icon")} passed`
          : `${plural(summary.failed, "icon")} with issues · ${numberFormat.format(summary.renamed + summary.rounded)} fixed`,
        summary.failed === 0 ? "success" : "idle",
      );
      return;
    }
    case "library-synced": {
      const extras = [
        message.added > 0 ? `${numberFormat.format(message.added)} added` : "",
        message.retained > 0 ? `${numberFormat.format(message.retained)} custom kept` : "",
      ].filter(Boolean);
      finishAction(
        `${message.created ? "Created" : "Updated"} ${plural(message.count, "icon")}${extras.length ? ` · ${extras.join(" · ")}` : ""}`,
        "success",
      );
      return;
    }
    case "error":
      finishAction(message.message, "error");
      return;
  }
};

updateActions();
