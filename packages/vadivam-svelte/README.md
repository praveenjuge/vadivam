# vadivam-svelte

Tree-shakeable 24px outline and solid SVG icons for Svelte.

[Browse icons](https://vadivam.praveenjuge.com) · [Svelte docs](https://vadivam.praveenjuge.com/docs/svelte) · [Source](https://github.com/praveenjuge/vadivam/tree/main/packages/vadivam-svelte) · [GitHub](https://github.com/praveenjuge/vadivam)

[![npm version](https://img.shields.io/npm/v/vadivam-svelte?style=flat-square&color=111)](https://www.npmjs.com/package/vadivam-svelte)
[![downloads](https://img.shields.io/npm/dw/vadivam-svelte?style=flat-square&color=666)](https://www.npmjs.com/package/vadivam-svelte)
[![license](https://img.shields.io/npm/l/vadivam-svelte?style=flat-square&color=111)](https://github.com/praveenjuge/vadivam/blob/main/LICENSE)

![All Vadivam icons](https://raw.githubusercontent.com/praveenjuge/vadivam/main/apps/docs/public/preview.png?v=0.0.81)

```sh
npm install vadivam-svelte
```

```svelte
<script>
  import { Activity, VadivamProvider } from "vadivam-svelte";
</script>

<VadivamProvider size={20} color="navy"><Activity /></VadivamProvider>
```

- Native SVG attributes plus size, color, stroke width, and accessible titles
- Tree-shakeable named and per-icon imports
- Provider and typed dynamic icon APIs

Every icon also has a solid twin with the same name in `vadivam-svelte/solid`. Solid icons fill their shapes with `color` and take no stroke props:

```js
import { Activity } from "vadivam-svelte/solid";
```

<!-- vadivam-packages:start -->
Package family: [SVG and JavaScript](https://www.npmjs.com/package/vadivam) · [React](https://www.npmjs.com/package/vadivam-react) · [React Native](https://www.npmjs.com/package/vadivam-react-native) · [Vue](https://www.npmjs.com/package/vadivam-vue) · [Solid](https://www.npmjs.com/package/vadivam-solid) · [Preact](https://www.npmjs.com/package/vadivam-preact) · [Astro](https://www.npmjs.com/package/vadivam-astro) · [Angular](https://www.npmjs.com/package/vadivam-angular) · [Qwik](https://www.npmjs.com/package/vadivam-qwik) · [Lit](https://www.npmjs.com/package/vadivam-lit) · [Flutter](https://pub.dev/packages/vadivam) · [Compose](https://central.sonatype.com/artifact/com.praveenjuge/vadivam-compose) · [MCP server](https://www.npmjs.com/package/vadivam-mcp)
<!-- vadivam-packages:end -->

[Issues](https://github.com/praveenjuge/vadivam/issues)
