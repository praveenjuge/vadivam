import { afterEach, expect, mock, test } from "bun:test";

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

afterEach(() => {
  document.body.replaceChildren();
});

test("renders an accessible glyph grid, filters by tag and category, and sends one-click choices", async () => {
  document.body.innerHTML = `
    <main>
      <input id="search" />
      <select id="category"><option value="">All</option></select>
      <div id="lucide-bar" hidden><span id="lucide-message"></span><button id="lucide-swap"></button></div>
      <div id="results"></div>
      <dialog id="confirm"><form method="dialog"><p id="confirm-message"></p></form></dialog>
    </main>`;
  const sent: unknown[] = [];
  window.parent.postMessage = (message: unknown) => sent.push(message);
  await import(`../src/ui.ts?test=${Date.now()}`);

  const search = document.querySelector<HTMLInputElement>("#search")!;
  const category = document.querySelector<HTMLSelectElement>("#category")!;
  expect(document.querySelectorAll(".icon-button")).toHaveLength(2);
  expect(
    document.querySelector('[aria-label="search"] use')?.getAttribute("href"),
  ).toBe("#i-search");
  expect([...category.options].map((option) => option.textContent)).toEqual([
    "All",
    "Files",
    "Text formatting",
  ]);

  search.value = "garbage";
  search.dispatchEvent(new Event("input"));
  expect(
    [...document.querySelectorAll(".icon-button")].map((button) => button.getAttribute("aria-label")),
  ).toEqual(["trash-2"]);

  search.value = "";
  category.value = "text";
  category.dispatchEvent(new Event("change"));
  expect(
    [...document.querySelectorAll(".icon-button")].map((button) => button.getAttribute("aria-label")),
  ).toEqual(["search"]);
  category.value = "";
  category.dispatchEvent(new Event("change"));

  window.dispatchEvent(
    new MessageEvent("message", {
      data: { pluginMessage: { type: "catalog", count: 2 } },
    }),
  );
  const trash = document.querySelector<HTMLButtonElement>('[aria-label="trash-2"]')!;
  expect(trash.title).toBe("trash-2");
  trash.click();
  expect(sent[sent.length - 1]).toEqual({
    pluginMessage: { type: "choose", iconName: "trash-2" },
  });
  expect(trash.disabled).toBe(true);

  window.dispatchEvent(
    new MessageEvent("message", {
      data: { pluginMessage: { type: "complete", message: "Inserted trash-2" } },
    }),
  );
  expect(search.value).toBe("");
  expect(trash.disabled).toBe(false);

  const lucideBar = document.querySelector<HTMLElement>("#lucide-bar")!;
  const swap = document.querySelector<HTMLButtonElement>("#lucide-swap")!;
  const selection = (count: number) =>
    window.dispatchEvent(
      new MessageEvent("message", { data: { pluginMessage: { type: "lucide-selection", count } } }),
    );
  selection(3);
  expect(lucideBar.hidden).toBe(false);
  expect(lucideBar.textContent).toContain("3 Lucide icons selected");
  swap.click();
  expect(sent[sent.length - 1]).toEqual({ pluginMessage: { type: "swap-lucide" } });
  expect(swap.disabled).toBe(true);
  expect(trash.disabled).toBe(true);
  window.dispatchEvent(
    new MessageEvent("message", {
      data: { pluginMessage: { type: "complete", message: "Swapped 3 Lucide icons for Vadivam" } },
    }),
  );
  expect(swap.disabled).toBe(false);
  selection(0);
  expect(lucideBar.hidden).toBe(true);
});
