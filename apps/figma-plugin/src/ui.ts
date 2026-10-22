import index from "vadivam:ui-catalog";
import { createEntries, searchIcons, type IconEntry } from "./catalog";
import type { PluginToUiMessage, UiToPluginMessage } from "./protocol";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const COLUMNS = 6;
// About three screens of icons; more render as the list scrolls near its end.
const BATCH_SIZE = 180;
const LOAD_MORE_DISTANCE = 480;

function element<T extends Element>(selector: string): T {
  const match = document.querySelector<T>(selector);
  if (!match) throw new Error(`Missing UI element: ${selector}`);
  return match;
}

const search = element<HTMLInputElement>("#search");
const categorySelect = element<HTMLSelectElement>("#category");
const results = element<HTMLDivElement>("#results");
const confirmDialog = element<HTMLDialogElement>("#confirm");
const confirmMessage = element<HTMLParagraphElement>("#confirm-message");
const lucideBar = element<HTMLDivElement>("#lucide-bar");
const lucideMessage = element<HTMLSpanElement>("#lucide-message");
const lucideSwap = element<HTMLButtonElement>("#lucide-swap");

const entries = createEntries(index.icons, new Map(index.categories));
// Buttons are built once per icon and reused, so a keystroke only moves existing nodes.
const buttons = new Map<string, HTMLButtonElement>();
let visible: IconEntry[] = [];
let renderedCount = 0;
let pending = false;
let confirmationId: string | null = null;

for (const [id, title] of index.categories) {
  const option = document.createElement("option");
  option.value = id;
  option.textContent = title;
  categorySelect.append(option);
}

function send(message: UiToPluginMessage): void {
  parent.postMessage({ pluginMessage: message }, "*");
}

function setPending(value: boolean): void {
  pending = value;
  lucideSwap.disabled = value;
  for (const button of results.querySelectorAll<HTMLButtonElement>("button")) {
    button.disabled = value;
  }
}

function choose(iconName: string): void {
  if (pending) return;
  setPending(true);
  send({ type: "choose", iconName });
}

function iconButton(name: string): HTMLButtonElement {
  let button = buttons.get(name);
  if (button) return button;
  button = document.createElement("button");
  button.type = "button";
  button.className = "icon-button";
  button.title = name;
  button.setAttribute("aria-label", name);
  button.setAttribute("role", "gridcell");
  button.dataset.iconName = name;
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(SVG_NAMESPACE, "use");
  use.setAttribute("href", `#i-${name}`);
  svg.append(use);
  button.append(svg);
  buttons.set(name, button);
  return button;
}

function renderMore(count = BATCH_SIZE): void {
  const end = Math.min(visible.length, renderedCount + count);
  if (end <= renderedCount) return;
  const fragment = document.createDocumentFragment();
  for (; renderedCount < end; renderedCount += 1) {
    const button = iconButton(visible[renderedCount]!.name);
    button.disabled = pending;
    fragment.append(button);
  }
  results.append(fragment);
}

function render(): void {
  visible = searchIcons(entries, search.value, categorySelect.value);
  renderedCount = 0;
  results.scrollTop = 0;
  if (visible.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No icons match. Try another word or category.";
    results.replaceChildren(empty);
    return;
  }
  results.replaceChildren();
  renderMore();
}

function focusResult(index: number): void {
  const target = Math.max(0, Math.min(index, visible.length - 1));
  if (target >= renderedCount) renderMore(target - renderedCount + BATCH_SIZE);
  (results.children[target] as HTMLButtonElement | undefined)?.focus();
}

search.addEventListener("input", render);
categorySelect.addEventListener("change", render);
search.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" && visible.length > 0) {
    event.preventDefault();
    focusResult(0);
  } else if (event.key === "Enter" && visible[0]) {
    event.preventDefault();
    choose(visible[0].name);
  }
});

results.addEventListener("scroll", () => {
  if (results.scrollHeight - results.scrollTop - results.clientHeight < LOAD_MORE_DISTANCE) {
    renderMore();
  }
});

results.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>(".icon-button");
  if (button?.dataset.iconName) choose(button.dataset.iconName);
});

results.addEventListener("keydown", (event) => {
  const target = event.target as HTMLElement;
  if (!target.matches("button")) return;
  const movement: Record<string, number> = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -COLUMNS,
    ArrowDown: COLUMNS,
  };
  const delta = movement[event.key];
  if (delta !== undefined) {
    event.preventDefault();
    focusResult([...results.children].indexOf(target) + delta);
  }
});

lucideSwap.addEventListener("click", () => {
  if (pending) return;
  setPending(true);
  send({ type: "swap-lucide" });
});

confirmDialog.addEventListener("close", () => {
  if (!confirmationId) return;
  const requestId = confirmationId;
  confirmationId = null;
  send({
    type: "confirm-replace",
    requestId,
    accepted: confirmDialog.returnValue === "confirm",
  });
  if (confirmDialog.returnValue !== "confirm") {
    setPending(false);
    search.focus();
  }
});

window.onmessage = (event: MessageEvent<{ pluginMessage?: PluginToUiMessage }>) => {
  const message = event.data.pluginMessage;
  if (!message) return;
  if (message.type === "catalog") {
    search.focus();
  } else if (message.type === "complete") {
    setPending(false);
    search.value = "";
    render();
    search.focus();
  } else if (message.type === "confirm-replace") {
    confirmationId = message.requestId;
    confirmMessage.textContent = `Replace ${message.iconName} and update ${message.instanceCount} instance${message.instanceCount === 1 ? "" : "s"}?`;
    confirmDialog.showModal();
  } else if (message.type === "lucide-selection") {
    lucideBar.hidden = message.count === 0;
    lucideMessage.textContent = `${message.count} Lucide icon${message.count === 1 ? "" : "s"} selected`;
  } else if (message.type === "error") {
    setPending(false);
    search.focus();
  }
};

render();
