---
title: Installation
description: Install the Vadivam package and peer dependencies for your application stack.
---

Install only the package for the environment where the icons render. Every Vadivam package is ESM-only and publishes tree-shakeable named and per-icon exports.

## Package commands

```sh
# SVG assets and browser JavaScript
npm install vadivam

# Web frameworks
npm install vadivam-react
npm install vadivam-vue
npm install vadivam-svelte
npm install vadivam-solid
npm install vadivam-angular
npm install vadivam-astro
npm install vadivam-preact

# React Native or Expo
npm install vadivam-react-native react-native-svg
```

The same package names work with other package managers:

```sh
pnpm add vadivam-react
bun add vadivam-react
yarn add vadivam-react
```

## Peer requirements

The current packages declare these peer ranges:

| Package                | Peer dependencies                                             |
| ---------------------- | ------------------------------------------------------------- |
| `vadivam-react`        | React 18 or newer                                             |
| `vadivam-react-native` | React 18–19, React Native 0.71+, and `react-native-svg` 12–15 |
| `vadivam-vue`          | Vue 3.5                                                       |
| `vadivam-svelte`       | Svelte 5.56+                                                  |
| `vadivam-solid`        | Solid 1.9                                                     |
| `vadivam-angular`      | Angular 22                                                    |
| `vadivam-astro`        | Astro 7                                                       |
| `vadivam-preact`       | Preact 10.29                                                  |

Check the installed package's peer dependency warnings when upgrading a framework. The package export maps are intentionally version-specific for several framework integrations.

## Import styles

Use a named import for normal application code:

```ts
import { Activity, Search } from "vadivam-react";
```

A per-icon import is also available:

```ts
import Activity from "vadivam-react/activity";
// Equivalent explicit path:
import Search from "vadivam-react/icons/search";
```

The framework packages also expose `/dynamic` and `/dynamicIconImports` entry points. Those are intended for names selected at runtime; see [Dynamic icons](/docs/dynamic-icons).

The core package exposes different values at its icon paths:

```js
import activityNode from "vadivam/icons/activity";
import activitySvgUrl from "vadivam/icons/activity.svg";
```

The first import is an icon-node data structure. The second is the optimized SVG asset path, interpreted according to your bundler's asset handling. Learn more in [Core SVG and JavaScript](/docs/core).
