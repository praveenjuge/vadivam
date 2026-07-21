import icons from "vadivam:catalog";
import { searchIcons, type CatalogIcon } from "./catalog";
import type { PluginToUiMessage, UiToPluginMessage } from "./protocol";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

function element<T extends Element>(selector: string): T {
  const match = document.querySelector<T>(selector);
  if (!match) throw new Error(`Missing UI element: ${selector}`);
  return match;
}

const search = element<HTMLInputElement>("#search");
const results = element<HTMLDivElement>("#results");
const confirmDialog = element<HTMLDialogElement>("#confirm");
const confirmMessage = element<HTMLParagraphElement>("#confirm-message");

const catalog: CatalogIcon[] = [...icons].sort((left, right) =>
  left.name.localeCompare(right.name),
);
let visible: CatalogIcon[] = [];
let pending = false;
let confirmationId: string | null = null;

function send(message: UiToPluginMessage): void {
  parent.postMessage({ pluginMessage: message }, "*");
}

function setPending(value: boolean): void {
  pending = value;
  for (const button of results.querySelectorAll<HTMLButtonElement>("button")) {
    button.disabled = value;
  }
}

function choose(iconName: string): void {
  if (pending) return;
  setPending(true);
  send({ type: "choose", iconName });
}

function iconPreview(icon: CatalogIcon): SVGSVGElement {
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");

  for (const [tag, attributes] of icon.iconNode) {
    const geometry = document.createElementNS(SVG_NAMESPACE, tag);
    for (const [name, value] of Object.entries(attributes)) {
      if (name !== "key") geometry.setAttribute(name, value);
    }
    svg.append(geometry);
  }
  return svg;
}

function render(): void {
  visible = searchIcons(catalog, search.value);
  results.replaceChildren();
  if (visible.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No matching icon. Try a shorter or different name.";
    results.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const icon of visible) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "icon-button";
    button.title = icon.name;
    button.setAttribute("aria-label", icon.name);
    button.setAttribute("role", "gridcell");
    button.dataset.iconName = icon.name;
    button.append(iconPreview(icon));
    button.addEventListener("click", () => choose(icon.name));
    fragment.append(button);
  }
  results.append(fragment);
  setPending(pending);
}

function focusResult(index: number): void {
  const buttons = [...results.querySelectorAll<HTMLButtonElement>("button")];
  buttons[Math.max(0, Math.min(index, buttons.length - 1))]?.focus();
}

search.addEventListener("input", render);
search.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" && visible.length > 0) {
    event.preventDefault();
    focusResult(0);
  } else if (event.key === "Enter" && visible[0]) {
    event.preventDefault();
    choose(visible[0].name);
  }
});

results.addEventListener("keydown", (event) => {
  const target = event.target as HTMLButtonElement;
  if (!target.matches("button")) return;
  const buttons = [...results.querySelectorAll<HTMLButtonElement>("button")];
  const index = buttons.indexOf(target);
  const movement: Record<string, number> = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -6,
    ArrowDown: 6,
  };
  const delta = movement[event.key];
  if (delta !== undefined) {
    event.preventDefault();
    focusResult(index + delta);
  }
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
    search.placeholder = "Search icons…";
    render();
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
  } else if (message.type === "error") {
    setPending(false);
    search.focus();
  }
};
