# Vadivam Icons for Figma

Public Figma companion for searching and inserting the canonical Vadivam icon set as editable local components. The catalog is bundled from the repository's validated `icons/` directory and works without network access.

Search matches icon names, Lucide tags, and category titles, the same way the website does, and the category menu narrows the grid. Every inserted component gets a short description listing its categories and tags, plus a link to its icon page, so Figma's asset search finds it by those words too.

Select a frame that holds Lucide icons, or the icons themselves, and the plugin offers to swap them to Vadivam. It recognizes square, vector-only layers named after a Lucide icon (`arrow-right`, `ArrowRight`, `lucide/arrow-right`, or a deprecated name such as `home`), keeps each layer's size, stroke color and weight, and layout position, and turns repeats of the same icon into instances of one new component. A local Lucide component is redrawn in place so its instances update with it.

The UI previews icons from one SVG sprite parsed with the HTML, keeps search fields precomputed, and renders matches in batches as the grid scrolls. The canvas bundle stores each icon's SVG body without the shared root element.

## Development

1. Run `bun run figma-plugin:build` from the repository root.
2. In Figma, choose **Plugins → Development → Import plugin from manifest…**.
3. Select `apps/figma-plugin/manifest.json`.

Use `bun run figma-plugin:dev` while editing and `bun run test:figma-plugin` before publishing.

## Community release

1. Build and test the release commit.
2. Download the matching `vadivam-figma-vX.Y.Z.zip` GitHub Release asset.
3. Keep the registered plugin ID `1661323620355050204` unchanged for every update.
4. Import the manifest in Figma and complete the manual checks below.
5. Publish the update with the prepared icon, cover, screenshots, support URL, privacy statement, and concise listing copy required by the current Community form.

### Manual checks

- Search, keyboard navigation, insert, replace, undo, and redo.
- Swap Lucide icons placed by the Lucide plugin and from the Lucide community library, then undo the swap.
- Light and dark themes.
- Empty files, auto-layout parents, tagged components with instances, and selected instances.
- Confirm the plugin requests no permissions and reports no network domains.

The plugin stores only its schema version and canonical icon name as plugin data on components it creates. It collects no personal data and makes no network requests.
