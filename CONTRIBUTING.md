# Contributing to Vadivam

Vadivam is a Bun monorepo. SVG files in `icons/` are the canonical source; generated package and website assets should not be edited by hand.

## Setup

```sh
bun install
bun run dev  # docs at http://localhost:4321
```

Keep pull requests focused and describe any visible or package API changes.

## Icon changes

Draw every icon to the [design guide](https://vadivam.praveenjuge.com/docs/design-guide), which covers the canvas, stroke, pixel grid, keyline shapes, corner radii, spacing, naming, and what `icons:check` rejects. Normalize and validate source SVGs before submitting changes:

```sh
bun run icons:optimize
bun run icons:check
```

## Validate

Focused checks while iterating:

```sh
bun run icons:check
bun run test:vadivam
bun run test:react:unit
bun run test:frameworks:unit
```

Run the full suite before submitting. It regenerates packages, runs every unit test, builds the docs site, and compiles the framework integration apps in Chromium, so a current Node (24.x) and Playwright's Chromium are required:

```sh
bun run test
```
