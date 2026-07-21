---
title: Vadivam
description: Pixel-perfect 24px outline icons for SVG, JavaScript, and modern UI frameworks.
sidebar:
  label: Introduction
---

<!-- vadivam-icon-count:start -->
Vadivam is an open-source set of 260 pixel-perfect 24px outline icons. Use optimized SVG assets, browser JavaScript helpers, or native components for React, React Native, Vue, Svelte, Solid, Angular, Astro, and Preact.
<!-- vadivam-icon-count:end -->

Designers can use the bundled, offline Figma plugin to search the same canonical catalog and place editable local components.

## Get started

Install the package for your stack:

```sh
npm install vadivam-react
```

Render a statically imported icon:

```tsx
import { Activity } from "vadivam-react";

export function Status() {
  return <Activity size={20} aria-label="Activity" />;
}
```

Static named imports are tree-shakeable and are the best default when the icon is known while writing the application. Use a [dynamic icon API](/docs/dynamic-icons) only when an icon name comes from data at runtime.

## Choose a package

| Target                     | Package                | Guide                              |
| -------------------------- | ---------------------- | ---------------------------------- |
| SVG and browser JavaScript | `vadivam`              | [Core package](/docs/core)         |
| React                      | `vadivam-react`        | [React](/docs/react)               |
| React Native and Expo      | `vadivam-react-native` | [React Native](/docs/react-native) |
| Vue                        | `vadivam-vue`          | [Vue](/docs/vue)                   |
| Svelte                     | `vadivam-svelte`       | [Svelte](/docs/svelte)             |
| Solid                      | `vadivam-solid`        | [Solid](/docs/solid)               |
| Angular                    | `vadivam-angular`      | [Angular](/docs/angular)           |
| Astro                      | `vadivam-astro`        | [Astro](/docs/astro)               |
| Preact                     | `vadivam-preact`       | [Preact](/docs/preact)             |
| Figma                      | Vadivam Icons plugin   | [Plugin source](https://github.com/praveenjuge/vadivam/tree/main/apps/figma-plugin) |

All packages are ESM-only. Icon components accept native SVG attributes in addition to Vadivam's sizing and stroke props. See [installation](/docs/installation) for peer requirements and [usage](/docs/usage) for styling and accessibility guidance.

Browse the icon catalog at [vadivam.praveenjuge.com](https://vadivam.praveenjuge.com). Icon names use kebab case in data APIs, such as `activity` and `arrow-right`, and PascalCase for component imports, such as `Activity` and `ArrowRight`.

## Next steps

- [Install the right package](/docs/installation)
- [Use raw SVGs and JavaScript](/docs/core)
- [Style and label icons](/docs/usage)
- [Load icons from runtime names](/docs/dynamic-icons)
- [Contribute icons or code](/docs/contributing)
