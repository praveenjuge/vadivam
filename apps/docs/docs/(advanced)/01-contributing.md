---
title: Contributing and icon guidelines
description: Set up the Vadivam monorepo and contribute safe, consistent 24px outline icons.
---

Vadivam is a Bun monorepo. Source SVGs in the root `icons/` directory are canonical; package distributions and website assets are generated and must not be edited by hand.

## Set up the repository

```sh
git clone https://github.com/praveenjuge/vadivam.git
cd vadivam
bun install
bun run dev
```

Keep pull requests focused and describe visible changes and package API changes.

## Add or update an icon

Add or replace only the source SVG in `icons/`. Every icon must use:

- a `24x24` canvas and `viewBox="0 0 24 24"`
- `fill="none"`
- `stroke="currentColor"`
- `stroke-width="2"`
- round stroke caps and joins
- outline geometry consistent with the existing set

Do not add fills, gradients, masks, scripts, inline styles, external references, or other unsafe SVG features.

Normalize source SVGs, then validate them without writing further changes:

```sh
bun run icons:optimize
bun run icons:check
```

The generated package and site assets come from `bun run icons:build`. Do not hand-edit generated output to fix an icon; correct the canonical SVG and regenerate.

## Validate changes

Run the full project checks before submitting:

```sh
bun run test
```

Focused commands are available while iterating:

```sh
bun run icons:check
bun run test:vadivam
bun run test:vadivam-react
bun run test:vadivam-react-native
bun run test:integration
```

Framework integration tests build real applications against freshly generated local packages. React Native compatibility is checked through a minimal Expo integration for Android and iOS.

## Documentation changes

Documentation source lives in `apps/docs/docs`. Use Markdown where possible, include `title` and `description` YAML frontmatter, keep examples executable, and use links rooted at `/docs` for documentation pages.

For package behavior, verify the package README, `package.json` export map, and generated public declarations before documenting it. Do not infer an API from another framework package: providers, dynamic exports, fallback types, and peer ranges differ.

Report bugs or propose changes through [GitHub issues](https://github.com/praveenjuge/vadivam/issues).
