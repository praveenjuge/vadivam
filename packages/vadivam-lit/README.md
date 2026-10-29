# vadivam-lit

Tree-shakeable 24px outline SVG icons for Lit.

[Browse icons](https://vadivam.praveenjuge.com) · [Lit docs](https://vadivam.praveenjuge.com/docs/lit) · [Source](https://github.com/praveenjuge/vadivam/tree/main/packages/vadivam-lit) · [GitHub](https://github.com/praveenjuge/vadivam)

[![npm version](https://img.shields.io/npm/v/vadivam-lit?style=flat-square&color=111)](https://www.npmjs.com/package/vadivam-lit)
[![downloads](https://img.shields.io/npm/dw/vadivam-lit?style=flat-square&color=666)](https://www.npmjs.com/package/vadivam-lit)
[![license](https://img.shields.io/npm/l/vadivam-lit?style=flat-square&color=111)](https://github.com/praveenjuge/vadivam/blob/main/LICENSE)

![All Vadivam icons](https://raw.githubusercontent.com/praveenjuge/vadivam/main/apps/docs/public/preview.png?v=0.0.73)

```sh
npm install vadivam-lit
```

```ts
import { html } from "lit";
import { Activity } from "vadivam-lit";

html`<button>${Activity({ size: 20, label: "Activity" })}</button>`;
```

- Static `svg` templates that render on the client, in shadow roots, and with Lit SSR
- Size, color, stroke width, and accessible labels
- Tree-shakeable named and per-icon imports, plus a typed dynamic icon API

Package family: [SVG and JavaScript](https://www.npmjs.com/package/vadivam) · [React](https://www.npmjs.com/package/vadivam-react) · [React Native](https://www.npmjs.com/package/vadivam-react-native) · [Vue](https://www.npmjs.com/package/vadivam-vue) · [Svelte](https://www.npmjs.com/package/vadivam-svelte) · [Solid](https://www.npmjs.com/package/vadivam-solid) · [Angular](https://www.npmjs.com/package/vadivam-angular) · [Astro](https://www.npmjs.com/package/vadivam-astro) · [Preact](https://www.npmjs.com/package/vadivam-preact) · [Qwik](https://www.npmjs.com/package/vadivam-qwik) · [Flutter](https://pub.dev/packages/vadivam) · [Jetpack Compose](https://central.sonatype.com/artifact/com.praveenjuge/vadivam-compose) · [MCP server](https://www.npmjs.com/package/vadivam-mcp)

[Issues](https://github.com/praveenjuge/vadivam/issues)
