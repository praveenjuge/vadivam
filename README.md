# Vadivam

<!-- vadivam-icon-count:start -->

Vadivam is a free, open-source library of 1949 pixel-perfect 24px outline SVG icons for React, React Native, Vue, Svelte, Solid, Angular, Astro, Preact, Qwik, Lit, Flutter, Jetpack Compose, and plain HTML.

<!-- vadivam-icon-count:end -->

[![npm version](https://img.shields.io/npm/v/vadivam?style=flat-square&color=111)](https://www.npmjs.com/package/vadivam)
[![downloads](https://img.shields.io/npm/dw/vadivam?style=flat-square&color=666)](https://www.npmjs.com/package/vadivam)
[![license](https://img.shields.io/npm/l/vadivam?style=flat-square&color=111)](./LICENSE)

![All Vadivam icons](./apps/docs/public/preview.png?v=0.0.72)

[Browse all icons](https://vadivam.praveenjuge.com), copy SVG or framework-ready components, or use the [Figma plugin](https://vadivam.praveenjuge.com/docs/figma-plugin) to place editable local components.

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
| [`vadivam-qwik`](https://www.npmjs.com/package/vadivam-qwik)                 | Qwik                  |
| [`vadivam-lit`](https://www.npmjs.com/package/vadivam-lit)                   | Lit                   |
| [`vadivam`](https://pub.dev/packages/vadivam) on pub.dev                     | Flutter               |
| [`com.praveenjuge:vadivam-compose`](https://central.sonatype.com/artifact/com.praveenjuge/vadivam-compose) | Jetpack Compose and Android Views |
| [`vadivam-mcp`](https://www.npmjs.com/package/vadivam-mcp)                   | MCP server for agents |

Using shadcn/ui? Every icon is also a [registry item](https://vadivam.praveenjuge.com/docs/shadcn): `npx shadcn@latest add https://vadivam.praveenjuge.com/r/arrow-right.json`.

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

Coming from Lucide? Vadivam icons keep their Lucide names, and one command moves a project over: `npx vadivam migrate-lucide --write`. See [Migrate from Lucide](https://vadivam.praveenjuge.com/docs/migrate-from-lucide).

Plain HTML and htmx can load `<vadivam-icon name="activity">` from `vadivam/elements` with one script tag. Every package supports tree-shakeable named and per-icon imports. Framework packages also provide dynamic icon APIs for data-driven names.

AI agents can search icons and get code through the MCP server at `https://vadivam.praveenjuge.com/mcp` or `npx -y vadivam-mcp`. See [MCP server](https://vadivam.praveenjuge.com/docs/mcp).

[Docs](https://vadivam.praveenjuge.com/docs) · [Contributing](https://vadivam.praveenjuge.com/docs/contributing) · [Issues](https://github.com/praveenjuge/vadivam/issues) · [Changelog](https://vadivam.praveenjuge.com/changelog) · [MIT License](./LICENSE)
