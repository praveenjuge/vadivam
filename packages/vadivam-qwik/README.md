# vadivam-qwik

Tree-shakeable 24px outline and solid SVG icons for Qwik.

[Browse icons](https://vadivam.praveenjuge.com) · [Qwik docs](https://vadivam.praveenjuge.com/docs/qwik) · [Source](https://github.com/praveenjuge/vadivam/tree/main/packages/vadivam-qwik) · [GitHub](https://github.com/praveenjuge/vadivam)

[![npm version](https://img.shields.io/npm/v/vadivam-qwik?style=flat-square&color=111)](https://www.npmjs.com/package/vadivam-qwik)
[![downloads](https://img.shields.io/npm/dw/vadivam-qwik?style=flat-square&color=666)](https://www.npmjs.com/package/vadivam-qwik)
[![license](https://img.shields.io/npm/l/vadivam-qwik?style=flat-square&color=111)](https://github.com/praveenjuge/vadivam/blob/main/LICENSE)

![All Vadivam icons](https://raw.githubusercontent.com/praveenjuge/vadivam/main/apps/docs/public/preview.png?v=0.0.81)

```sh
npm install vadivam-qwik
```

```tsx
import { Activity } from "vadivam-qwik";

<Activity size={20} color="navy" />;
```

- Inline components that render on the server and ship no client JavaScript
- Native SVG attributes and `$` event handlers plus size, color, stroke width, and accessible titles
- Tree-shakeable named and per-icon imports

Requires Qwik 2 (`@qwik.dev/core`).

Every icon also has a solid twin with the same name in `vadivam-qwik/solid`. Solid icons fill their shapes with `color` and take no stroke props:

```js
import { Activity } from "vadivam-qwik/solid";
```

<!-- vadivam-packages:start -->
Package family: [SVG and JavaScript](https://www.npmjs.com/package/vadivam) · [React](https://www.npmjs.com/package/vadivam-react) · [React Native](https://www.npmjs.com/package/vadivam-react-native) · [Vue](https://www.npmjs.com/package/vadivam-vue) · [Svelte](https://www.npmjs.com/package/vadivam-svelte) · [Solid](https://www.npmjs.com/package/vadivam-solid) · [Preact](https://www.npmjs.com/package/vadivam-preact) · [Astro](https://www.npmjs.com/package/vadivam-astro) · [Angular](https://www.npmjs.com/package/vadivam-angular) · [Lit](https://www.npmjs.com/package/vadivam-lit) · [Flutter](https://pub.dev/packages/vadivam) · [Compose](https://central.sonatype.com/artifact/com.praveenjuge/vadivam-compose) · [MCP server](https://www.npmjs.com/package/vadivam-mcp)
<!-- vadivam-packages:end -->

[Issues](https://github.com/praveenjuge/vadivam/issues)
