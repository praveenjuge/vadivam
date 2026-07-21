import { afterEach, expect, mock, test } from "bun:test";

mock.module("vadivam:catalog", () => ({
  default: [
    {
      name: "search",
      svg: "<svg />",
      iconNode: [["circle", { cx: "12", cy: "12", r: "4", key: "circle-0" }]],
    },
    {
      name: "trash-2",
      svg: "<svg />",
      iconNode: [["path", { d: "M3 6h18", key: "path-0" }]],
    },
  ],
}));

afterEach(() => {
  document.body.replaceChildren();
});

test("renders an accessible glyph grid and sends one-click choices", async () => {
  document.body.innerHTML = `
    <main>
      <input id="search" />
      <div id="results"></div>
      <dialog id="confirm"><form method="dialog"><p id="confirm-message"></p></form></dialog>
    </main>`;
  const sent: unknown[] = [];
  window.parent.postMessage = (message: unknown) => sent.push(message);
  await import(`../src/ui.ts?test=${Date.now()}`);

  window.dispatchEvent(
    new MessageEvent("message", {
      data: {
        pluginMessage: {
          type: "catalog",
          count: 2,
        },
      },
    }),
  );

  const search = document.querySelector<HTMLInputElement>("#search")!;
  expect(search.placeholder).toBe("Search icons…");
  expect(document.querySelector("#status")).toBeNull();
  expect(document.querySelectorAll(".icon-button")).toHaveLength(2);
  expect(document.querySelector('[aria-label="search"] circle')?.getAttribute("r")).toBe("4");
  const trash = document.querySelector<HTMLButtonElement>('[aria-label="trash-2"]')!;
  expect(trash.title).toBe("trash-2");
  trash.click();
  expect(sent[sent.length - 1]).toEqual({
    pluginMessage: { type: "choose", iconName: "trash-2" },
  });

  window.dispatchEvent(
    new MessageEvent("message", {
      data: { pluginMessage: { type: "complete", message: "Inserted trash-2" } },
    }),
  );
  expect(search.value).toBe("");
});
