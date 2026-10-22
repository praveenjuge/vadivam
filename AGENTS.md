# AGENTS.md

## Project Overview

Vadivam is a Bun monorepo for a 24px outline icon set.

- `icons/` is the canonical source exported from Figma.
- `packages/vadivam` publishes optimized raw SVGs and metadata, plus the `npx vadivam migrate-lucide` codemod; its hand-written CLI source is `packages/vadivam/src`, copied into `dist` with the generated manifest and Lucide alias map.
- `packages/vadivam-react` publishes generated React components.
- `packages/vadivam-react-native` publishes generated React Native components.
- `packages/vadivam-{vue,svelte,solid,angular,astro,preact}` publish generated native framework components.
- `apps/docs/public/r/` is the generated shadcn/ui registry (`registry.json` plus one item per icon and the shared `vadivam-icon` base), served at `/r/`.
- `packages/vadivam-mcp` publishes the MCP server for AI agents (stdio CLI plus `createVadivamServer()`); its hand-written source is `packages/vadivam-mcp/src`, and `dist` adds generated icon data and `scripts/snippets.mjs`. `packages/vadivam-mcp/server.json` is its MCP Registry entry.
- The docs Worker entry `apps/docs/worker/index.mjs` serves the same MCP server at `/mcp` and delegates every other request to Blume's Worker; `scripts/docs-worker.mjs` bundles it during the docs build.
- Generated package/web assets come from `bun run icons:build`; do not edit generated output by hand.

## Setup Commands

- Install dependencies: `bun install`
- Start the website locally: `bun run dev`
- Build packages and website: `bun run build`
- Run all checks: `bun run test`
- Test the raw SVG package: `bun run test:vadivam`
- Test the React package: `bun run test:vadivam-react`
- Test the React Native package: `bun run test:vadivam-react-native`
- Test the MCP server package: `bun run test:vadivam-mcp`
- Smoke-test an MCP endpoint: `bun run mcp:smoke <url>` (for `/mcp` locally, run `bun run docs:build`, then `bunx wrangler dev`; `bun run dev` does not serve `/mcp`)
- Run the React render/SSR/exports unit suite only: `bun run test:react:unit`
- Test the shadcn/ui registry (schemas plus a real `shadcn add` into a scratch project): `bun run test:shadcn`
- Build and browser-test all framework integration apps: `bun run test:integration`
- React Native compatibility is verified by the minimal Expo integration app for Android and iOS.
- Build and deploy the Cloudflare server Worker: `bun run deploy`
- Deploy only the docs Worker (builds docs first): `bun run deploy:worker`

## Icon Workflow

- Add or replace SVGs only in the root `icons/` folder.
- Normalize SVGs in place with `bun run icons:optimize`.
- Validate without writing files with `bun run icons:check`.
- Follow the design guide at `apps/docs/docs/(design)/01-design-guide.mdx` (published at `/docs/design-guide`): 24x24 canvas, 1px padding, one 2px centered `currentColor` stroke with round caps/joins, whole-pixel horizontal and vertical lines, the `circle`/`square` keylines, corner radii with 60% corner smoothing, and gaps of at least 1.5px.
- Corner smoothing is generated, never hand-drawn: keep corners as circular arcs in Figma and `bun run icons:optimize` applies `scripts/corner-smoothing.mjs`; `icons:check` rejects plain rounded corners.
- Path cleanup is generated too: `bun run icons:optimize` applies `scripts/path-cleanup.mjs` first, joining strokes Figma split where they meet, removing stray subpaths, and snapping horizontal/vertical lines less than 0.1px off the pixel grid; `icons:check` rejects path data it would still change, and ink that reaches into the 1px padding.
- Keep icons outline-only. Do not add fills, gradients, masks, scripts, inline styles, external references, or unsafe SVG features; `validateSvgContent` in `scripts/icons.mjs` is the source of truth for what is rejected.
- When bumping `lucideVersion` in `metadata/lucide.json`, pin the same `lucide` version in `apps/docs/package.json`; icon pages render Lucide's drawing from it for the side-by-side comparison.
- When a guide rule becomes machine-checkable and every icon passes, enforce it in `scripts/icons.mjs` and update the guide. `bun scripts/icon-geometry.mjs` reports the measurements the guide quotes.

## Code Style

- Prefer small, direct modules over abstraction layers.
- Keep one canonical implementation path; remove dead or duplicate code when replacing behavior.
- Keep the website minimal: compact type, simple ruled sections, no nested card layouts.
- Keep package APIs ESM-only and generated from the canonical icon source.

## Testing Instructions

- Run `bun run test` before committing.
- Package tests live in `tests/` and use `bun test`.
- React render tests (`tests/vadivam-react/*.client.test.mjs`) run against happy-dom via the `tests/setup/happydom.ts` preload; SSR and export-coverage tests run with no DOM. Keep these two groups separate so SSR tests stay in a true server environment.
- Framework compatibility is verified with real apps under `tests/integration/`. Each consumes a freshly generated local package through a `file:` dependency, uses a committed lockfile, produces a production build, and—where browser rendering applies—is served and asserted in Chromium.
- For icon-only changes, run `bun run icons:optimize` and `bun run icons:check` first.
- For website UI changes, verify the rendered page in a browser at desktop and mobile widths.
- If GitHub Actions fails, inspect logs with `gh run view --log-failed` before changing workflow files.

## Release Instructions

- Keep the root package, every entry in `scripts/packages.mjs`, and `packages/vadivam-mcp/server.json` on one synchronized version.
- Release by committing the version bump and pushing a matching tag such as `v0.0.3`.
- The `Release` workflow tests, packs, publishes, and verifies all ten npm packages through npm Trusted Publishing, publishes `packages/vadivam-mcp/server.json` to the MCP Registry, then creates the matching GitHub Release.
- Do not publish manually unless the user explicitly asks.

## Security Notes

- Do not commit secrets, npm tokens, Cloudflare tokens, `.env` files, or local auth output.
- Use GitHub Actions OIDC/npm Trusted Publishing for releases.
- Treat SVG input as untrusted; keep validation strict before publishing or deploying.

## Cursor Cloud specific instructions

- **Bun 1.4.3** is required (`packageManager` in root `package.json`). If `bun` is missing, install with `curl -fsSL https://bun.sh/install | bash -s "bun-v1.4.3"` and ensure `~/.bun/bin` is on `PATH`.
- **Playwright Chromium** is required for `bun run test:integration` (one-time): `bunx playwright install --with-deps chromium`.
- The docs dev server (`bun run dev`) listens on **port 4321**. Stop it before `bun run test` — `apps/docs check` (Blume) fails if a dev server is already bound to that port.
- **Angular integration** needs Node **≥ 22.22.3** (or 24.x). Cloud VMs may expose Node 22.14.0 at `/exec-daemon/node` ahead of `nvm`; run `nvm install 24.15.0` and prepend `$HOME/.nvm/versions/node/v24.15.0/bin` to `PATH` when running `bun run test:integration` or full `bun run test`.
- No Docker, database, or external API is needed for local development.
