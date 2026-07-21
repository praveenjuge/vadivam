# Vadivam Icons for Figma

Public Figma companion for searching and inserting the canonical Vadivam icon set as editable local components. The catalog is bundled from the repository's validated `icons/` directory and works without network access.

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
- Light and dark themes.
- Empty files, auto-layout parents, tagged components with instances, and selected instances.
- Confirm the plugin requests no permissions and reports no network domains.

The plugin stores only its schema version and canonical icon name on components it creates. It collects no personal data and makes no network requests.
