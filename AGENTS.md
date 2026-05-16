# AGENTS.md

## Project Overview

Vadivam is a Bun monorepo for a 24px outline icon set.

- `icons/` is the canonical source exported from Figma.
- `packages/vadivam` publishes optimized raw SVGs and metadata.
- `packages/vadivam-react` publishes generated React components.
- `apps/web` is the native Astro explorer and docs site.
- Generated package/web assets come from `bun run icons:build`; do not edit generated output by hand.

## Setup Commands

- Install dependencies: `bun install`
- Start the website locally: `bun run dev`
- Build packages and website: `bun run build`
- Run all checks: `bun run test`
- Deploy the static Workers site: `bun run deploy`

## Icon Workflow

- Add or replace SVGs only in the root `icons/` folder.
- Normalize SVGs in place with `bun run icons:optimize`.
- Validate without writing files with `bun run icons:check`.
- Keep every icon `24x24` with `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="2"`, and round caps/joins.
- Keep icons outline-only. Do not add fills, gradients, masks, scripts, inline styles, external references, or unsafe SVG features.

## Code Style

- Prefer small, direct modules over abstraction layers.
- Keep one canonical implementation path; remove dead or duplicate code when replacing behavior.
- Keep Astro pages mostly native Astro and browser JavaScript. Do not add React to `apps/web`.
- Keep the website minimal: compact type, simple ruled sections, no nested card layouts.
- Keep package APIs ESM-only and generated from the canonical icon source.

## Testing Instructions

- Run `bun run test` before committing.
- For icon-only changes, run `bun run icons:optimize` and `bun run icons:check` first.
- For website UI changes, verify the rendered page in a browser at desktop and mobile widths.
- If GitHub Actions fails, inspect logs with `gh run view --log-failed` before changing workflow files.

## Release Instructions

- Keep the root package, `packages/vadivam`, and `packages/vadivam-react` versions in sync.
- Release by committing the version bump and pushing a matching tag such as `v0.0.3`.
- The `Release` workflow publishes both npm packages through npm Trusted Publishing.
- Do not publish manually unless the user explicitly asks.

## Security Notes

- Do not commit secrets, npm tokens, Cloudflare tokens, `.env` files, or local auth output.
- Use GitHub Actions OIDC/npm Trusted Publishing for releases.
- Treat SVG input as untrusted; keep validation strict before publishing or deploying.
