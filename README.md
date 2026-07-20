# Vadivam

Vadivam is a free, open-source library of 240 pixel-perfect 24px outline SVG icons for React, React Native, Vue, Svelte, Solid, Angular, Astro, and Preact.

[![npm version](https://img.shields.io/npm/v/vadivam?style=flat-square&color=111)](https://www.npmjs.com/package/vadivam)
[![downloads](https://img.shields.io/npm/dw/vadivam?style=flat-square&color=666)](https://www.npmjs.com/package/vadivam)
[![license](https://img.shields.io/npm/l/vadivam?style=flat-square&color=111)](./LICENSE)

![All Vadivam icons](./apps/docs/public/preview.png?v=0.0.27)

[Browse all icons](https://vadivam.praveenjuge.com) and copy SVG or framework-ready components.

## Packages

| Package                                                                      | Target                |
| ---------------------------------------------------------------------------- | --------------------- |
| [`vadivam`](https://www.npmjs.com/package/vadivam)                           | SVG and JavaScript    |
| [`vadivam-react`](https://www.npmjs.com/package/vadivam-react)               | React                 |
| [`vadivam-react-native`](https://www.npmjs.com/package/vadivam-react-native) | React Native and Expo |
| [`vadivam-vue`](https://www.npmjs.com/package/vadivam-vue)                   | Vue                   |
| [`vadivam-svelte`](https://www.npmjs.com/package/vadivam-svelte)             | Svelte                |
| [`vadivam-solid`](https://www.npmjs.com/package/vadivam-solid)               | Solid                 |
| [`vadivam-angular`](https://www.npmjs.com/package/vadivam-angular)           | Angular               |
| [`vadivam-astro`](https://www.npmjs.com/package/vadivam-astro)               | Astro                 |
| [`vadivam-preact`](https://www.npmjs.com/package/vadivam-preact)             | Preact                |

## Quick start

```sh
npm install vadivam-react
```

```tsx
import { Activity } from "vadivam-react";

export function Example() {
  return <Activity size={20} aria-label="Activity" />;
}
```

Every package supports tree-shakeable named and per-icon imports. Framework packages also provide dynamic icon APIs for data-driven names.

[Contributing](./CONTRIBUTING.md) · [Issues](https://github.com/praveenjuge/vadivam/issues) · [Releases](https://github.com/praveenjuge/vadivam/releases) · [MIT License](./LICENSE)
