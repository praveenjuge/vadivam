# Vadivam Internal

Private Figma workflow for maintaining Vadivam's source frames and publishable Community library.

## Use it

1. Run `bun run plugin:build` from the repository root.
2. In Figma, choose **Plugins → Development → Import plugin from manifest…**.
3. Select `apps/vadivam-internal/manifest.json`.
4. Run **Vadivam Internal** in the Vadivam Icons file, choose a batch size, and generate the frames.

## Create or update the Community library

Choose **Create** in the **Icon library** row to generate one `Vadivam Icons` component set from every SVG in the root `icons/` folder. Each canonical icon is a 24×24 variant under the searchable **Icon** property. The component set is a simple white horizontal auto-layout frame with wrapping enabled, exactly 20 icons per row, 24 px padding, and 24 px horizontal and vertical gaps.

The component set includes usage and maintenance documentation linked to the Vadivam site. Every selected variant includes its own description and links directly to its icon page, such as `https://vadivam.praveenjuge.com/icons/align-center-vertical`.

After changing `icons/`, rebuild and run the internal plugin in the library file, then choose **Update**. Existing main components are updated in place so published instances keep their component identities, new canonical icons are added in alphabetical order, and custom or retired variants are retained. If the page contains multiple plugin-generated sets, select the intended set before updating it.

The latest stable canonical Lucide icon names and the default popularity order from [lucide.dev/icons](https://lucide.dev/icons/) are stored locally under `src/data/` and bundled into the plugin, so Figma does not depend on cross-origin network access. Popularity follows Lucide's icon-page visitor ranking over the previous 12 months. The plugin scans every page for named top-level `24×24` nodes and creates the next missing Lucide names on the current page with the canonical white fill, visible red `2 px` grid, SVG export settings, `40 px` column step, and `72 px` row step.

Run `bun run update:lucide-data -- /path/to/lucide-release-checkout` from `apps/vadivam-internal` to refresh the canonical name list, deprecated aliases, and official popularity order. The checkout must be on an exact stable Lucide release tag.

It can also arrange recognized icons alphabetically in a 20-column grid and audit every icon frame for canonical Lucide naming, including a replacement warning for deprecated aliases, `24×24` size, no background fill or layout guides, stroke-only artwork, zero corner radius, `2 px` stroke weight, round caps and joins, and zero rotation. Auditing also normalizes every stroked artwork layer name to `Vector` and automatically makes its stroke endpoints round.
