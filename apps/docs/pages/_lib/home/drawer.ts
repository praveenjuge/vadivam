// The drawer that opens over the grid for one icon: its code, previews,
// customizer, and copy and download actions, with prev/next through what's
// on screen.
import { pascalCase, pathIconSvg, styles } from "../../../../../scripts/icon-styles.mjs";
import {
  bindCustomizer,
  copyText,
  renderPreviews,
  runAction,
  showStrokeSettings,
  snippetHtml,
  snippetText,
  wireMenus,
  type IconRef,
  type SettingsStore,
} from "../icon-tools";
import { defaultTab, iconPagePath, recall, remember, setUrlParams, statusLine, storageKeys } from "../site";
import type { SnippetTemplates } from "../snippet-templates";
import { cardFrom, nameOf, type Grid } from "./grid";
import type { Search } from "./search";

const chipClass =
  "rounded-full border border-border bg-transparent px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

function chip(label: string, attributes: Record<string, string>) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = chipClass;
  button.textContent = label;
  for (const [key, value] of Object.entries(attributes)) button.setAttribute(key, value);
  return button;
}

interface DrawerOptions {
  grid: Grid;
  search: Search;
  store: SettingsStore;
  templates: SnippetTemplates | null;
  version: string;
  hideTooltip: () => void;
  signal: AbortSignal;
}

export function createDrawer({ grid, search, store, templates, version, hideTooltip, signal }: DrawerOptions) {
  const explorer = document.querySelector<HTMLElement>("#iconExplorer")!;
  const browser = document.querySelector<HTMLElement>("#iconBrowser")!;
  const drawer = document.querySelector<HTMLElement>("#iconDrawer")!;
  const drawerName = document.querySelector<HTMLElement>("#drawerName")!;
  const drawerComponent = document.querySelector<HTMLElement>("#drawerComponent")!;
  const drawerCode = document.querySelector<HTMLElement>("#drawerCode")!;
  const drawerOpenPage = document.querySelector<HTMLAnchorElement>("#drawerOpenPage")!;
  const drawerCategories = document.querySelector<HTMLElement>("#drawerCategories")!;
  const drawerTags = document.querySelector<HTMLElement>("#drawerTags")!;
  const drawerMeta = document.querySelector<HTMLElement>("#drawerMeta")!;
  const prevButton = document.querySelector<HTMLButtonElement>("#drawerPrev")!;
  const nextButton = document.querySelector<HTMLButtonElement>("#drawerNext")!;
  const tabButtons = Array.from(drawer.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const setStatus = statusLine(document.querySelector<HTMLElement>("#drawerStatus")!);

  let selected: HTMLAnchorElement | null = null;
  let activeTab = recall(storageKeys.tab) ?? defaultTab;
  if (!tabButtons.some((button) => button.dataset.tab === activeTab)) activeTab = defaultTab;

  const selectedEntry = () => (selected ? grid.entryByName.get(nameOf(selected)) : undefined);

  // Rebuilt from the icon's path data; the build checks this matches the
  // manifest. Null while the icon's solid paths are still loading.
  const currentIcon = (): IconRef | null => {
    const entry = selectedEntry();
    const paths = entry && grid.paths(entry);
    if (!entry || !paths) return null;
    return { name: entry.name, componentName: pascalCase(entry.name), svg: pathIconSvg(styles[grid.style], paths), style: grid.style };
  };

  const renderMeta = () => {
    const entry = selectedEntry();
    if (!entry) return;
    drawerCategories.replaceChildren(...entry.categories.map((id) => chip(search.categoryTitle(id), { "data-filter-category": id })));
    drawerTags.replaceChildren(...entry.tags.slice(0, 12).map((tag) => chip(tag, { "data-filter-tag": tag })));
    drawerMeta.hidden = entry.categories.length + entry.tags.length === 0;
  };

  const render = () => {
    showStrokeSettings(drawer, grid.style);
    const icon = currentIcon();
    if (!icon) {
      // Stepping in solid can reach a chunk that hasn't loaded yet. Clear
      // the last icon's code and previews so they never show under this name.
      drawerCode.replaceChildren();
      for (const preview of drawer.querySelectorAll("[data-icon-preview]")) preview.replaceChildren();
      const entry = selectedEntry();
      if (entry && grid.style === "solid") grid.loadSolidChunk(entry.chunk).then(render, () => {});
      return;
    }
    const settings = store.get();
    drawerCode.innerHTML = snippetHtml(templates, activeTab, icon, settings);
    renderPreviews(drawer, icon, settings);
    for (const button of tabButtons) button.setAttribute("aria-selected", String(button.dataset.tab === activeTab));
  };

  // Prev/next follow what's on screen by entry, so they never force
  // unrendered matches into the DOM.
  const selectedIndex = () => {
    const entry = selectedEntry();
    return entry ? search.visibleEntries().indexOf(entry) : -1;
  };

  const syncNavigation = () => {
    const index = selectedIndex();
    prevButton.disabled = index <= 0;
    nextButton.disabled = index < 0 || index >= search.visibleEntries().length - 1;
  };

  const select = (card: HTMLAnchorElement) => {
    selected?.setAttribute("aria-current", "false");
    selected = card;
    card.setAttribute("aria-current", "true");
    const name = nameOf(card);
    drawerName.textContent = name;
    drawerComponent.textContent = pascalCase(name);
    drawerOpenPage.href = iconPagePath(name, grid.style);
    render();
    renderMeta();
    search.loadIndex()?.then(renderMeta);
    syncNavigation();
  };

  const open = (card: HTMLAnchorElement, { updateUrl = true } = {}) => {
    hideTooltip();
    select(card);
    drawer.inert = false;
    drawer.setAttribute("data-open", "");
    if (updateUrl) setUrlParams({ icon: nameOf(card) || null });
  };

  const close = ({ updateUrl = true } = {}) => {
    if (!drawer.hasAttribute("data-open")) return;
    drawer.removeAttribute("data-open");
    drawer.inert = true;
    const card = selected;
    selected?.setAttribute("aria-current", "false");
    selected = null;
    if (updateUrl) setUrlParams({ icon: null });
    if (drawer.contains(document.activeElement) || document.activeElement === document.body) card?.focus({ preventScroll: true });
  };

  const step = (direction: 1 | -1) => {
    const index = selectedIndex() + direction;
    const entry = search.visibleEntries()[index];
    if (!entry) return;
    search.renderThrough(index);
    const next = search.filtering() ? search.cloneOf(entry) : entry.card;
    open(next);
    next.scrollIntoView({ block: "nearest" });
    if (browser.contains(document.activeElement)) next.focus({ preventScroll: true });
  };

  browser.addEventListener("click", (event) => {
    const mouse = event as MouseEvent;
    // Modified clicks (new tab/window) follow the real /icons/<name> link.
    if (mouse.metaKey || mouse.ctrlKey || mouse.shiftKey || mouse.altKey || mouse.button !== 0) return;
    const card = cardFrom(event);
    if (!card) return;
    event.preventDefault();
    open(card);
  });

  for (const tab of tabButtons) {
    tab.addEventListener("click", () => {
      activeTab = tab.dataset.tab ?? defaultTab;
      remember(storageKeys.tab, activeTab);
      render();
    });
  }

  document.querySelector("#drawerClose")?.addEventListener("click", () => close());
  prevButton.addEventListener("click", () => step(-1));
  nextButton.addEventListener("click", () => step(1));

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        hideTooltip();
        if (!document.querySelector(":popover-open")) close();
        return;
      }
      if (!drawer.hasAttribute("data-open") || event.altKey || event.metaKey || event.ctrlKey) return;
      const target = event.target as HTMLElement;
      if (target.closest("input, select, textarea, [contenteditable], [role=tablist], [popover]")) return;
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        step(event.key === "ArrowRight" ? 1 : -1);
      }
    },
    { signal },
  );

  drawer.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    const category = target.closest<HTMLElement>("[data-filter-category]")?.dataset.filterCategory;
    const query = target.closest<HTMLElement>("[data-filter-tag]")?.dataset.filterTag;
    if (category || query) {
      search.filterBy({ category, query });
      return;
    }
    const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
    const icon = currentIcon();
    if (!action || !icon) return;
    try {
      if (action === "copy-code") {
        await copyText(snippetText(activeTab, icon, store.get()));
        setStatus("Snippet copied.");
      } else {
        setStatus(await runAction(action, icon, store.get(), version, drawer));
      }
    } catch {
      setStatus("Couldn't complete that action in this browser.");
    }
  });

  wireMenus(drawer);

  // Keep the grid's last rows reachable above the open drawer.
  const syncClearance = () => {
    explorer.style.paddingBottom = drawer.hasAttribute("data-open") ? `${drawer.offsetHeight + 24}px` : "";
  };
  const resizeObserver = new ResizeObserver(syncClearance);
  resizeObserver.observe(drawer);
  const openObserver = new MutationObserver(syncClearance);
  openObserver.observe(drawer, { attributes: true, attributeFilter: ["data-open"] });
  signal.addEventListener("abort", () => {
    resizeObserver.disconnect();
    openObserver.disconnect();
  });

  // Swipe the drawer down to close it on touch screens.
  let dragStart: number | null = null;
  for (const zone of [document.querySelector<HTMLElement>("#drawerHandle"), document.querySelector<HTMLElement>("#drawerHeader")]) {
    zone?.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "touch" || (event.target as HTMLElement).closest("button, a")) return;
      dragStart = event.clientY;
      drawer.style.transition = "none";
    });
  }
  addEventListener("pointermove", (event) => {
    if (dragStart === null) return;
    drawer.style.transform = `translateY(${Math.max(0, event.clientY - dragStart)}px)`;
  }, { signal });
  const endDrag = () => {
    dragStart = null;
    drawer.style.transition = "";
    drawer.style.transform = "";
  };
  addEventListener("pointerup", (event) => {
    if (dragStart === null) return;
    const distance = event.clientY - dragStart;
    endDrag();
    if (distance > 80) close();
  }, { signal });
  // The browser cancels the pointer when it takes the touch over as a
  // scroll; reset without closing so no stale drag follows later touches.
  addEventListener("pointercancel", () => {
    if (dragStart !== null) endDrag();
  }, { signal });

  // The customizer shares its settings with the icon pages through localStorage.
  const customizer = drawer.querySelector<HTMLElement>("[data-customizer]");
  if (customizer) bindCustomizer(customizer, store);
  document.querySelector<HTMLDetailsElement>("#drawerCustomize")!.open = matchMedia("(min-width: 768px)").matches;

  // A filter swaps which grid is on screen, so move the selection to the
  // matching tile there (or leave it alone when the icon is filtered out).
  const followSelection = () => {
    if (!selected) return;
    const entry = grid.entryByName.get(nameOf(selected));
    if (!entry) return;
    const tile = !search.filtering() ? entry.card : search.isMatch(entry) ? search.cloneOf(entry) : null;
    if (tile && tile !== selected) {
      selected.setAttribute("aria-current", "false");
      tile.setAttribute("aria-current", "true");
      selected = tile;
    }
    syncNavigation();
  };

  return {
    selectedEntry,
    render,
    followSelection,
    /** A style change rebuilds the tile the drawer follows and the icon it shows. */
    restyle() {
      followSelection();
      if (selected) drawerOpenPage.href = iconPagePath(nameOf(selected), grid.style);
      render();
    },
    /** `/?icon=name` opens the drawer on that icon. */
    openLinked() {
      const name = new URLSearchParams(location.search).get("icon");
      const card = name ? grid.entryByName.get(name)?.card : null;
      if (!card) return;
      open(card, { updateUrl: false });
      card.scrollIntoView({ block: "center" });
    },
  };
}
