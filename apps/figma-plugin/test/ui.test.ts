import { beforeAll, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";

mock.module("vadivam:ui-catalog", () => ({
  default: {
    categories: [
      ["files", "Files"],
      ["text", "Text formatting"],
    ],
    icons: [
      ["search", ["find", "magnifier"], ["text"]],
      ["trash-2", ["garbage", "delete"], ["files"]],
    ],
  },
}));

const sent: unknown[] = [];

beforeAll(async () => {
  const html = readFileSync(new URL("../src/ui.html", import.meta.url), "utf8");
  document.body.innerHTML = /<body>([\s\S]*)<\/body>/.exec(html)![1]!;
  window.parent.postMessage = (message: unknown) => sent.push(message);
  await import("../src/ui");
});

const $ = <T extends Element>(selector: string) => document.querySelector<T>(selector)!;
const labels = () => [...document.querySelectorAll(".icon-button")].map((button) => button.getAttribute("aria-label"));
const lastSent = () => (sent[sent.length - 1] as { pluginMessage: unknown }).pluginMessage;
const receive = (pluginMessage: unknown) => window.dispatchEvent(new MessageEvent("message", { data: { pluginMessage } }));

function type(selector: string, value: string, event: string): void {
  const field = $<HTMLInputElement | HTMLSelectElement>(selector);
  field.value = value;
  field.dispatchEvent(new Event(event));
}

test("renders the catalog as a grid of sprite previews", () => {
  expect(labels()).toEqual(["search", "trash-2"]);
  expect($("#results").getAttribute("style")).toContain("--columns: 6");
  expect([...$<HTMLSelectElement>("#category").options].map((option) => option.textContent)).toEqual([
    "All",
    "Files",
    "Text formatting",
  ]);
  const preview = $('[aria-label="search"] svg');
  expect(preview.querySelector("use")?.getAttribute("href")).toBe("#vadivam-search");
  expect(preview.getAttribute("stroke")).toBe("currentColor");
  expect(preview.getAttribute("fill")).toBe("none");
});

test("filters by tag and by category", () => {
  type("#search", "garbage", "input");
  expect(labels()).toEqual(["trash-2"]);
  type("#search", "", "input");
  type("#category", "text", "change");
  expect(labels()).toEqual(["search"]);
  type("#category", "", "change");
});

test("sends a choice and waits for the plugin before taking another", () => {
  const trash = $<HTMLButtonElement>('[aria-label="trash-2"]');
  trash.click();
  expect(lastSent()).toEqual({ type: "choose", iconName: "trash-2", style: "outline" });
  expect(trash.disabled).toBe(true);
  type("#search", "trash", "input");
  receive({ type: "complete" });
  expect($<HTMLInputElement>("#search").value).toBe("");
  expect(trash.disabled).toBe(false);
});

test("offers to swap the Lucide icons in the selection", () => {
  const bar = $<HTMLElement>("#lucide-bar");
  const swap = $<HTMLButtonElement>("#lucide-swap");
  receive({ type: "lucide-selection", count: 3 });
  expect(bar.hidden).toBe(false);
  expect(bar.textContent).toContain("3 Lucide icons selected");
  swap.click();
  expect(lastSent()).toEqual({ type: "swap-lucide" });
  expect(swap.disabled).toBe(true);
  receive({ type: "error" });
  expect(swap.disabled).toBe(false);
  receive({ type: "lucide-selection", count: 0 });
  expect(bar.hidden).toBe(true);
});

test("asks before redrawing a component with instances and sends the answer", () => {
  receive({ type: "confirm-replace", requestId: "r1", iconName: "search", instanceCount: 2 });
  expect($("#confirm-message").textContent).toBe("Replace search and update 2 instances?");
  const dialog = $<HTMLDialogElement>("#confirm");
  dialog.returnValue = "confirm";
  dialog.dispatchEvent(new Event("close"));
  expect(lastSent()).toEqual({ type: "confirm-replace", requestId: "r1", accepted: true });
});

test("switches previews and choices to the solid style", () => {
  const solid = $<HTMLButtonElement>('[data-style="solid"]');
  solid.click();
  expect(solid.getAttribute("aria-pressed")).toBe("true");
  expect($('[data-style="outline"]').getAttribute("aria-pressed")).toBe("false");
  const preview = $('[aria-label="trash-2"] svg');
  expect(preview.querySelector("use")?.getAttribute("href")).toBe("#vadivam-solid-trash-2");
  expect(preview.getAttribute("fill")).toBe("currentColor");
  expect(preview.hasAttribute("stroke")).toBe(false);
  $<HTMLButtonElement>('[aria-label="trash-2"]').click();
  expect(lastSent()).toEqual({ type: "choose", iconName: "trash-2", style: "solid" });
});
