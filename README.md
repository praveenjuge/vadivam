# Vadivam

24px outline icons, published as raw SVGs and React components.

```sh
bun install
bun run icons:optimize
bun run test
bun run dev
```

## Workspaces

- `icons/` is the canonical Figma export folder.
- `packages/vadivam` publishes optimized SVGs and metadata.
- `packages/vadivam-react` publishes generated React components.
- `apps/web` is the Astro icon explorer.

## Rules

Icons must use `24x24`, `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="2"`, and round caps/joins.

## Release

Update all package versions, commit, then push a tag like `v0.0.2`. GitHub Actions publishes both npm packages through Trusted Publishing.
