# Vadivam Internal

Private Figma workflow for turning the live Lucide popularity ranking into the next empty Vadivam icon frames.

## Use it

1. Run `bun run plugin:build` from the repository root.
2. In Figma, choose **Plugins → Development → Import plugin from manifest…**.
3. Select `apps/vadivam-internal/manifest.json`.
4. Run **Vadivam Internal** in the Vadivam Icons file, choose a batch size, and generate the frames.

The popularity catalog and canonical Lucide icon-name list are stored locally under `src/data/` and bundled into the plugin, so Figma does not depend on cross-origin network access. The plugin scans every page for named top-level `24×24` nodes. It creates missing ranked icons on the current page with the canonical white fill, visible red `2 px` grid, SVG export settings, `40 px` column step, and `72 px` row step.

It can also arrange recognized icons alphabetically in a 20-column grid and audit every icon frame for Lucide naming, `24×24` size, no background fill or layout guides, stroke-only artwork, zero corner radius, `2 px` stroke weight, round caps and joins, and zero rotation. Auditing also normalizes every stroked artwork layer name to `Vector` and automatically makes its stroke endpoints round.
