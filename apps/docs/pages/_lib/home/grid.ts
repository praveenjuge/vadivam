// The homepage's full icon grid: one entry per tile, painted in the current
// style. Names and outline paths are in the HTML; solid paths load on demand,
// one grid chunk at a time, so the Solid toggle fetches only the chunks in
// view and the rest follow as they scroll near. A tile marks its painted style
// in `data-style`, which the CSS reads, so a tile still waiting on its paths
// keeps its look.
import { nameFields, type SearchEntry } from "../../../../figma-shared/search";
import { iconPagePath, type IconStyle } from "../site";

/** A tile and its search fields; tags and categories fill in when the search index loads. */
export type Entry = SearchEntry & {
  card: HTMLAnchorElement;
  /** The tile's copy in the search results, made on first match. */
  clone?: HTMLAnchorElement;
  /** The index of the grid chunk holding the card. */
  chunk: number;
  outline?: string[];
  solid?: string[];
};

/** A tile's aria-label is its icon name. */
export const nameOf = (card: Element | null) => card?.getAttribute("aria-label") ?? "";

/** The tile, in the grid or the search results, an event happened in. */
export const cardFrom = (event: Event) => (event.target as HTMLElement).closest<HTMLAnchorElement>(".icon-chunk > a");

export const inView = (element: Element) => {
  const { top, bottom } = element.getBoundingClientRect();
  return bottom > 0 && top < innerHeight;
};

const fetchJson = (url: string) =>
  fetch(url).then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))));

const pathData = (tile: Element) => Array.from(tile.querySelectorAll("path"), (path) => path.getAttribute("d") ?? "");

const svgPath = (d: string) => {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  return path;
};

export function createGrid(gridElement: HTMLElement, signal: AbortSignal) {
  const chunkElements = Array.from(gridElement.querySelectorAll<HTMLElement>(":scope > .icon-chunk"));
  const chunkEntries: Entry[][] = chunkElements.map((chunkElement, chunk) =>
    Array.from(chunkElement.querySelectorAll<HTMLAnchorElement>(":scope > a"), (card) => ({
      card,
      chunk,
      ...nameFields(nameOf(card)),
      tags: [],
      categories: [],
      categoryTitles: [],
    })),
  );
  const entries = chunkEntries.flat();
  const entryByName = new Map(entries.map((entry) => [entry.name, entry]));

  let style: IconStyle = "outline";
  const solidLoads = new Map<number, Promise<void>>();
  const loadSolidChunk = (chunk: number) => {
    let promise = solidLoads.get(chunk);
    if (!promise) {
      promise = fetchJson(chunkElements[chunk]?.dataset.solid ?? "")
        .then((paths: string[][]) => {
          chunkEntries[chunk]?.forEach((entry, index) => (entry.solid = paths[index]));
        })
        .catch((error) => {
          // Forget the failure so the next request retries.
          solidLoads.delete(chunk);
          throw error;
        });
      solidLoads.set(chunk, promise);
    }
    return promise;
  };

  /** An entry's paths in the current style, or undefined while its solid paths load. */
  const paths = (entry: Entry) => {
    // A card that was never painted still holds its outline paths.
    entry.outline ??= pathData(entry.card);
    return style === "solid" ? entry.solid : entry.outline;
  };

  // Shows a tile, the grid's or a search result's copy, in the current
  // style, loading its chunk's solid paths first when they're missing.
  const paint = (tile: HTMLAnchorElement, entry: Entry) => {
    const painting = style;
    if ((tile.dataset.style ?? "outline") === painting) return;
    const drawn = paths(entry);
    if (!drawn) {
      loadSolidChunk(entry.chunk).then(() => paint(tile, entry), () => {});
      return;
    }
    tile.firstElementChild?.replaceChildren(...drawn.map(svgPath));
    if (painting === "solid") tile.dataset.style = "solid";
    else delete tile.dataset.style;
    // New-tab and copied links open the icon page in the same style.
    tile.setAttribute("href", iconPagePath(entry.name, painting));
  };
  const paintChunk = (chunk: number) => {
    for (const entry of chunkEntries[chunk] ?? []) paint(entry.card, entry);
  };
  const chunksInView = () => chunkElements.flatMap((chunkElement, chunk) => (inView(chunkElement) ? [chunk] : []));

  // Chunks within half a screen of the viewport. Ones still in the last
  // style catch up as they scroll near.
  const nearChunks = new Set<number>();
  const chunkObserver = new IntersectionObserver(
    (observed) => {
      for (const item of observed) {
        const chunk = chunkElements.indexOf(item.target as HTMLElement);
        if (!item.isIntersecting) nearChunks.delete(chunk);
        else {
          nearChunks.add(chunk);
          paintChunk(chunk);
        }
      }
    },
    { rootMargin: "50% 0px" },
  );
  for (const chunkElement of chunkElements) chunkObserver.observe(chunkElement);
  signal.addEventListener("abort", () => chunkObserver.disconnect());

  return {
    element: gridElement,
    entries,
    entryByName,
    get style() {
      return style;
    },
    /** Switch styles and repaint the chunks in and near view; the rest follow as they scroll near. */
    setStyle(next: IconStyle) {
      style = next;
      for (const chunk of new Set([...chunksInView(), ...nearChunks])) paintChunk(chunk);
    },
    paths,
    paint,
    loadSolidChunk,
    chunksInView,
  };
}

export type Grid = ReturnType<typeof createGrid>;
