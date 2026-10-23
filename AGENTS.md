# AGENTS.md

The public docs in `apps/docs/docs` (published at https://vadivam.praveenjuge.com/docs) are the source of truth for everything about the icons and packages: the [design guide](apps/docs/docs/(icons)/01-design-guide.mdx), [how icons are built](apps/docs/docs/(icons)/02-how-icons-are-built.mdx), [categories and naming](apps/docs/docs/(icons)/03-categories.mdx), package APIs, [contributing](apps/docs/docs/(project)/01-contributing.mdx), and [versions](apps/docs/docs/(project)/02-versions.md). Read the relevant page before changing icons, packages, or docs, and update it in the same change. This file only holds what is specific to working in the repository.

## Repository map

- `icons/` is the canonical SVG source exported from Figma, and `icons-solid/` its solid twin under the same names; `metadata/lucide.json` holds the pinned Lucide version, tags, and categories.
- `scripts/icons.mjs` optimizes, checks, and builds each style in `styles`; `validateSvgContent` is the source of truth for what an SVG may contain. `scripts/solid-draft.mjs` drafts solid icons from outlines, guided by `metadata/solid-hints.json`. `scripts/path-cleanup.mjs`, `scripts/corner-smoothing.mjs`, and `scripts/icon-geometry.mjs` hold the geometry, and `scripts/generators/` the per-framework output.
- `packages/vadivam` (raw SVGs, metadata, and the `migrate-lucide` codemod in `src`), `packages/vadivam-{react,react-native,vue,svelte,solid,angular,astro,preact}`, and `packages/vadivam-mcp` (hand-written `src`, generated data in `dist`, `server.json` for the MCP Registry).
- `apps/docs` is the Blume docs site; `apps/docs/public/r/` is the generated shadcn/ui registry; `apps/docs/worker/index.mjs` serves `/mcp` and delegates the rest to Blume's Worker.
- `apps/figma-plugin` is the public Figma plugin; `apps/vadivam-internal` is the private Figma plugin for the source file.
- Generated output (package `dist`, registry, web icons, icon counts, the categories table) comes from `bun run icons:build`. Never edit it by hand.

## Commands

- `bun install`, `bun run dev` (docs on port 4321), `bun run build`.
- `bun run test` before committing; the focused commands are listed on the contributing page.
- Icon changes: `bun run icons:optimize`, then `bun run icons:check`.
- MCP endpoint smoke test: `bun run docs:build`, `bunx wrangler dev`, then `bun run mcp:smoke <url>` (`bun run dev` does not serve `/mcp`).
- Deploy: `bun run deploy`, or `bun run deploy:worker` for the docs Worker only.

## Conventions

- Prefer small, direct modules and one canonical implementation path; remove dead or duplicate code when replacing behavior.
- Keep package APIs ESM-only and generated from the canonical icon source.
- Keep the website minimal: compact type, simple ruled sections, no nested card layouts. Verify UI changes in a browser at desktop and mobile widths.
- When a design guide rule becomes machine-checkable and every icon passes, enforce it in `scripts/icons.mjs` and update the guide.
- When bumping `lucideVersion` in `metadata/lucide.json`, pin the same `lucide` version in `apps/docs/package.json`.
- React render tests (`tests/vadivam-react/*.client.test.mjs`) run on happy-dom through `tests/setup/happydom.ts`; SSR and export tests run with no DOM. Keep the two groups separate.
- Integration apps under `tests/integration/` consume freshly generated packages through `file:` dependencies with committed lockfiles.
- If GitHub Actions fails, read the logs with `gh run view --log-failed` before changing workflow files.

## Releases

- Keep the root package, every entry in `scripts/packages.mjs`, `apps/figma-plugin/package.json`, and `packages/vadivam-mcp/server.json` on one version.
- Release by committing the version bump and pushing a matching tag such as `v0.0.3`; the `Release` workflow publishes through npm Trusted Publishing and the MCP Registry. Do not publish manually unless asked.
- Never commit secrets, tokens, `.env` files, or local auth output.

## Cloud environments

- Install Bun at the `packageManager` version if missing: `curl -fsSL https://bun.sh/install | bash -s "bun-v1.4.3"`, with `~/.bun/bin` on `PATH`.
- Install Chromium once for integration tests: `bunx playwright install --with-deps chromium`.
- Stop `bun run dev` before `bun run test`; the docs check fails if port 4321 is taken.
- The Angular integration needs Node 22.22.3 or newer. If `/exec-daemon/node` shadows `nvm`, run `nvm install 24.15.0` and prepend `$HOME/.nvm/versions/node/v24.15.0/bin` to `PATH`.
