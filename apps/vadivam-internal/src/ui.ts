import type {
  IconAuditIssue,
  PluginToUiMessage,
  UiToPluginMessage,
} from "./protocol";
import type { PopularIcon } from "./catalog";

function element<T extends Element>(selector: string): T {
  const match = document.querySelector<T>(selector);
  if (!match) throw new Error(`Missing UI element: ${selector}`);
  return match;
}

const summary = element<HTMLParagraphElement>("#summary");
const status = element<HTMLParagraphElement>("#status");
const countInput = element<HTMLInputElement>("#count");
const generateButton = element<HTMLButtonElement>("#generate");
const copyButton = element<HTMLButtonElement>("#copy");
const refreshButton = element<HTMLButtonElement>("#refresh");
const arrangeButton = element<HTMLButtonElement>("#arrange");
const auditButton = element<HTMLButtonElement>("#audit");
const resultList = element<HTMLOListElement>("#results");

let candidates: PopularIcon[] = [];

function send(message: UiToPluginMessage): void {
  parent.postMessage({ pluginMessage: message }, "*");
}

function readCount(): number {
  const value = Number(countInput.value);
  if (!Number.isInteger(value)) return 20;
  return Math.min(100, Math.max(1, value));
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en", { notation: "compact" }).format(value);
}

function renderCandidates(): void {
  copyButton.hidden = false;
  resultList.replaceChildren();
  if (candidates.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No missing ranked icons remain in this feed.";
    resultList.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const icon of candidates) {
    const item = document.createElement("li");
    const rank = document.createElement("span");
    const name = document.createElement("span");
    const usage = document.createElement("span");
    rank.className = "rank";
    name.className = "name";
    usage.className = "usage";
    rank.textContent = `#${icon.rank}`;
    name.textContent = icon.slug;
    usage.textContent = `${formatNumber(icon.repositories)} repos`;
    item.append(rank, name, usage);
    fragment.append(item);
  }
  resultList.append(fragment);
}

function renderAudit(issues: IconAuditIssue[]): void {
  copyButton.hidden = true;
  resultList.replaceChildren();
  if (issues.length === 0) {
    const success = document.createElement("li");
    success.className = "empty success";
    success.textContent = "Every icon passed all checks.";
    resultList.append(success);
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const issue of issues) {
    const item = document.createElement("li");
    const name = document.createElement("span");
    const violations = document.createElement("span");
    item.className = "issue";
    name.className = "issue-name";
    violations.className = "violations";
    name.textContent = issue.name;
    violations.textContent = issue.violations.join(" · ");
    item.append(name, violations);
    fragment.append(item);
  }
  resultList.append(fragment);
}

countInput.addEventListener("change", () => {
  const count = readCount();
  countInput.value = String(count);
  send({ type: "set-count", count });
});

generateButton.addEventListener("click", () => {
  generateButton.disabled = true;
  status.textContent = "Creating canonical 24 px frames…";
  send({ type: "generate", count: readCount() });
});

refreshButton.addEventListener("click", () => send({ type: "refresh" }));
arrangeButton.addEventListener("click", () => {
  status.textContent = "Arranging recognized icons A–Z…";
  send({ type: "arrange" });
});
auditButton.addEventListener("click", () => {
  status.textContent = "Checking icon geometry and names…";
  send({ type: "audit" });
});

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(candidates.map((icon) => icon.slug).join("\n"));
    status.textContent = `Copied ${candidates.length} icon names`;
  } catch {
    status.textContent = "Clipboard permission was denied";
  }
});

window.onmessage = (event: MessageEvent<{ pluginMessage?: PluginToUiMessage }>) => {
  const message = event.data.pluginMessage;
  if (!message) return;

  if (message.type === "loading") {
    status.textContent = "Comparing this file with the ranked feed…";
    generateButton.disabled = true;
    copyButton.disabled = true;
    refreshButton.disabled = true;
    return;
  }

  refreshButton.disabled = false;
  if (message.type === "error") {
    status.textContent = message.message;
    generateButton.disabled = candidates.length === 0;
    copyButton.disabled = candidates.length === 0;
  } else if (message.type === "generated") {
    status.textContent = `Created ${message.names.length} frames on this page`;
  } else if (message.type === "arranged") {
    status.textContent = `Arranged ${message.count} icons A–Z · 20 per row`;
  } else if (message.type === "audit") {
    summary.textContent = `${message.summary.checked} icons checked on this page`;
    status.textContent = `${message.summary.passed} passed · ${message.summary.failed} need attention`;
    renderAudit(message.issues);
  } else if (message.type === "catalog") {
    candidates = message.candidates;
    const { summary: catalog } = message;
    summary.textContent = `${catalog.existingCount} in file · ${catalog.matchedCount} matched · ${catalog.remainingCount} queued`;
    status.textContent = `${candidates.length} next / ${catalog.currentPage}`;
    generateButton.disabled = candidates.length === 0;
    copyButton.disabled = candidates.length === 0;
    renderCandidates();
  }
};
