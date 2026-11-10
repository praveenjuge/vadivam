// Search and the category filter. Tags and categories load on first search
// intent. Filtering never touches the full grid: it goes dormant (keeping its
// rendering state) and only the matches render into a results grid, in chunks
// sized like the grid's. More matches render as the reader scrolls near the
// end, so a keystroke lays out tens of tiles instead of all of them.
import { searchIcons, searchTerms } from "../../../../figma-shared/search";
import { setUrlParams } from "../site";
import type { Entry, Grid } from "./grid";

type SearchIndex = { categories: Record<string, string>; icons: [string, string[], string][] };

export function createSearch(grid: Grid, chunkSize: number, signal: AbortSignal) {
  const search = document.querySelector<HTMLInputElement>("#iconSearch")!;
  const searchClear = document.querySelector<HTMLButtonElement>("#iconSearchClear")!;
  const categorySelect = document.querySelector<HTMLSelectElement>("#iconCategory")!;
  const resultCount = document.querySelector<HTMLElement>("#resultCount")!;
  const results = document.querySelector<HTMLElement>("#iconResults")!;
  const emptyState = document.querySelector<HTMLElement>("#emptyState")!;
  const emptyQuery = document.querySelector<HTMLElement>("#emptyQuery")!;

  let categoryTitles: Record<string, string> = {};
  let indexPromise: Promise<void> | null = null;
  const loadIndex = () =>
    (indexPromise ??= fetch(search.dataset.index ?? "")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
      .then((index: SearchIndex) => {
        categoryTitles = index.categories;
        for (const [name, tags, categories] of index.icons) {
          const entry = grid.entryByName.get(name);
          if (!entry) continue;
          entry.tags = tags;
          entry.categories = categories ? categories.split(" ") : [];
          entry.categoryTitles = entry.categories.map((id) => (categoryTitles[id] ?? id).toLowerCase());
        }
      })
      .catch(() => {
        // Name search keeps working without the index; retry on next intent.
        indexPromise = null;
      }));

  let matches: Entry[] | null = null;
  let renderedCount = 0;
  const sentinel = document.createElement("div");
  sentinel.setAttribute("aria-hidden", "true");

  const cloneOf = (entry: Entry) => {
    if (!entry.clone) {
      entry.clone = entry.card.cloneNode(true) as HTMLAnchorElement;
      entry.clone.setAttribute("aria-current", "false");
    }
    grid.paint(entry.clone, entry);
    return entry.clone;
  };

  const renderBatch = (size: number) => {
    if (!matches) return;
    // Each chunk is styled and contained like the full grid's, and
    // `.icon-chunk` reserves the height of exactly one full chunk.
    const end = Math.min(matches.length, renderedCount + size);
    while (renderedCount < end) {
      const chunk = document.createElement("div");
      chunk.className = "icon-chunk";
      const chunkEnd = Math.min(end, renderedCount + chunkSize);
      for (; renderedCount < chunkEnd; renderedCount += 1) chunk.append(cloneOf(matches[renderedCount]!));
      results.append(chunk);
    }
    if (renderedCount < matches.length) {
      results.after(sentinel);
      // Re-observing reports the sentinel's current state, so a sentinel
      // that is still in view after this batch asks for the next one.
      sentinelObserver.unobserve(sentinel);
      sentinelObserver.observe(sentinel);
    } else sentinel.remove();
  };

  const sentinelObserver = new IntersectionObserver(
    (observed) => {
      if (observed.some((item) => item.isIntersecting)) renderBatch(chunkSize);
    },
    { rootMargin: "800px 0px" },
  );
  signal.addEventListener("abort", () => sentinelObserver.disconnect());

  const filterListeners = new Set<() => void>();

  let filterFrame = 0;
  const applyFilter = () => {
    cancelAnimationFrame(filterFrame);
    filterFrame = requestAnimationFrame(() => {
      const category = categorySelect.value;
      if (searchTerms(search.value).length === 0 && !category) {
        matches = null;
        results.hidden = true;
        results.replaceChildren();
        sentinel.remove();
        grid.element.classList.remove("is-dormant");
        emptyState.hidden = true;
        resultCount.textContent = `${grid.entries.length} icons`;
      } else {
        matches = searchIcons(grid.entries, search.value, { category });
        grid.element.classList.add("is-dormant");
        results.replaceChildren();
        renderedCount = 0;
        results.hidden = matches.length === 0;
        renderBatch(chunkSize);
        emptyState.hidden = matches.length > 0;
        emptyQuery.textContent = [search.value.trim() && `“${search.value.trim()}”`, category && `in ${categorySelect.selectedOptions[0]?.textContent?.replace(/ \(\d+\)$/, "")}`]
          .filter(Boolean)
          .join(" ");
        resultCount.textContent = `${matches.length} of ${grid.entries.length} icons`;
      }
      for (const listener of filterListeners) listener();
    });
  };

  const filterNow = () => {
    searchClear.hidden = search.value.length === 0;
    applyFilter();
    setUrlParams({ q: search.value.trim() || null, category: categorySelect.value || null });
  };

  for (const eventName of ["focus", "pointerenter"]) {
    search.addEventListener(eventName, loadIndex, { once: true });
    categorySelect.addEventListener(eventName, loadIndex, { once: true });
  }
  search.addEventListener("input", () => {
    filterNow();
    if (search.value) loadIndex()?.then(applyFilter);
  });
  categorySelect.addEventListener("change", () => {
    filterNow();
    loadIndex()?.then(applyFilter);
  });
  searchClear.addEventListener("click", () => {
    search.value = "";
    filterNow();
    search.focus();
  });
  document.querySelector("#emptyReset")?.addEventListener("click", () => {
    search.value = "";
    categorySelect.value = "";
    filterNow();
    search.focus();
  });

  // "/" jumps to icon search from anywhere on this page. Captured on the
  // window so it wins over Blume's "/" docs search; ⌘K still opens that.
  addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "/" || event.altKey || event.metaKey || event.ctrlKey) return;
      if ((event.target as HTMLElement).closest?.("input, select, textarea, [contenteditable], dialog")) return;
      event.preventDefault();
      event.stopPropagation();
      search.focus();
      search.select();
    },
    { capture: true, signal },
  );

  // Deep links: `/?q=term&category=id` pre-fill and filter.
  const initial = new URLSearchParams(location.search);
  search.value = initial.get("q") ?? "";
  if (initial.get("category") && categorySelect.querySelector(`option[value="${CSS.escape(initial.get("category") ?? "")}"]`)) {
    categorySelect.value = initial.get("category") ?? "";
  }
  if (search.value || categorySelect.value) {
    searchClear.hidden = search.value.length === 0;
    applyFilter();
    loadIndex()?.then(applyFilter);
  }

  return {
    input: search,
    loadIndex,
    categoryTitle: (id: string) => categoryTitles[id] ?? id,
    /** What's on screen, in order: the ranked matches, or the full grid. */
    visibleEntries: () => matches ?? grid.entries,
    /** The match tiles rendered so far; none while the full grid shows. */
    shown: () => (matches ? matches.slice(0, renderedCount) : []),
    isMatch: (entry: Entry) => matches?.includes(entry) ?? false,
    filtering: () => matches !== null,
    cloneOf,
    /** Render matches up to `index`, in whole chunks: a partial one would knock the rows after it out of line. */
    renderThrough(index: number) {
      if (matches && index >= renderedCount) renderBatch(Math.ceil((index - renderedCount + 1) / chunkSize) * chunkSize);
    },
    /** Filter by a category or a tag, as the drawer's chips do. */
    filterBy({ category, query }: { category?: string; query?: string }) {
      if (category) categorySelect.value = category;
      if (query) search.value = query;
      filterNow();
    },
    /** Call `listener` after every filter pass, once the matching tiles are on screen. */
    onFilter(listener: () => void) {
      filterListeners.add(listener);
    },
  };
}

export type Search = ReturnType<typeof createSearch>;
