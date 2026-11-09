// The Outline/Solid switch over the grid, the search results, and the drawer.
import { setUrlParams, styleParam, type IconStyle } from "../site";
import { inView, type Entry, type Grid } from "./grid";
import type { Search } from "./search";

export function createStyleSwitch(grid: Grid, search: Search, drawnEntry: () => Entry | undefined) {
  const button = document.querySelector<HTMLButtonElement>("#iconStyle")!;
  const listeners = new Set<() => void>();
  // The latest click wins, even over solid paths still loading.
  let requestedStyle: IconStyle = "outline";

  const setStyle = async (style: IconStyle, { updateUrl = true } = {}) => {
    requestedStyle = style;
    if (style === grid.style) return;
    // The tiles in view, grid chunks and search results alike, and the
    // drawer's icon switch together once their paths are in. Tiles out of
    // view follow as theirs load.
    if (style === "solid") {
      const resultsInView = search.shown().filter((entry) => entry.clone && inView(entry.clone));
      const needed = new Set([...grid.chunksInView(), ...resultsInView.map((entry) => entry.chunk)]);
      const drawn = drawnEntry();
      if (drawn) needed.add(drawn.chunk);
      try {
        await Promise.all(Array.from(needed, grid.loadSolidChunk));
      } catch {
        // Fall back to the shown style so the next click retries solid.
        if (requestedStyle === style) requestedStyle = grid.style;
        return;
      }
      if (requestedStyle !== style) return;
    }
    grid.setStyle(style);
    // A search can change while the paths load, so paint what's shown now.
    for (const entry of search.shown()) search.cloneOf(entry);
    button.setAttribute("aria-checked", String(style === "solid"));
    for (const listener of listeners) listener();
    if (updateUrl) setUrlParams({ style: styleParam(style) });
  };

  // Each click flips the last requested style, so quick repeat clicks
  // still alternate while the solid paths are loading.
  button.addEventListener("click", () => setStyle(requestedStyle === "solid" ? "outline" : "solid"));
  // Fetch the chunks in view as soon as the visitor reaches for the toggle.
  button.addEventListener(
    "pointerenter",
    () => {
      for (const chunk of grid.chunksInView()) grid.loadSolidChunk(chunk).catch(() => {});
    },
    { once: true },
  );

  return {
    setStyle,
    /** Call `listener` once the grid has switched styles. */
    onChange(listener: () => void) {
      listeners.add(listener);
    },
  };
}
