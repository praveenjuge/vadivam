# Vadivam

Vadivam is a 24px outline icon system with raw SVG assets, Lucide-style React components, and a small Astro explorer.

## Packages

- `vadivam`: optimized SVG files and a typed manifest.
- `vadivam-react`: React components generated from the same canonical SVGs.
- `apps/web`: Astro explorer and documentation site.

## Local workflow

```sh
bun install
bun run icons:optimize
bun run test
bun run dev
```

Figma exports should be placed in the root `icons/` folder. Run `bun run icons:optimize` to normalize them in place, then `bun run icons:check` or `bun run test` before publishing.

## Icon rules

- `24x24` width, height, and viewBox.
- Outline-only.
- `currentColor` stroke.
- `2px` stroke width.
- Round line caps and joins.

Releases are intended to be tag-driven. Pushing a tag like `v0.0.2` should publish both packages once npm Trusted Publishing is configured for the GitHub workflow.

## Cloudflare Workers

The Astro explorer deploys as a Workers Static Assets site.

```sh
bun run deploy
```

For Cloudflare Workers Builds, use the repository root as the root directory, `bun run build` as the build command, and `bun run deploy:worker` as the deploy command.
