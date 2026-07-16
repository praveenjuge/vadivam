# Contributing to Vadivam

Vadivam is a Bun monorepo. SVG files in `icons/` are the canonical source; generated package and website assets should not be edited by hand.

## Setup

```sh
bun install
bun run dev
```

## Icon changes

Keep every icon at `24x24`, outline-only, and compatible with the existing stroke conventions. Normalize and validate source SVGs before submitting changes:

```sh
bun run icons:optimize
bun run icons:check
```

## Validate

```sh
bun run test
```

Keep pull requests focused and describe any visible or package API changes.
