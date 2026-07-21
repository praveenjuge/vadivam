import { afterEach, expect, test } from "bun:test";

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
          icons: [
            {
              name: "search",
              svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /></svg>',
            },
            {
              name: "trash-2",
              svg: '<svg viewBox="0 0 24 24"><path d="M3 6h18" /></svg>',
            },
          ],
        },
      },
    }),
  );

  const search = document.querySelector<HTMLInputElement>("#search")!;
  expect(search.placeholder).toBe("Search icons…");
  expect(document.querySelector("#status")).toBeNull();
  expect(document.querySelectorAll(".icon-button")).toHaveLength(2);
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
