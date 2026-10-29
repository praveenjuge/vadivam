# vadivam-solid

Tree-shakeable 24px outline and solid SVG icons for Solid.

[Browse icons](https://vadivam.praveenjuge.com) · [Solid docs](https://vadivam.praveenjuge.com/docs/solid) · [Source](https://github.com/praveenjuge/vadivam/tree/main/packages/vadivam-solid) · [GitHub](https://github.com/praveenjuge/vadivam)

[![npm version](https://img.shields.io/npm/v/vadivam-solid?style=flat-square&color=111)](https://www.npmjs.com/package/vadivam-solid)
[![downloads](https://img.shields.io/npm/dw/vadivam-solid?style=flat-square&color=666)](https://www.npmjs.com/package/vadivam-solid)
[![license](https://img.shields.io/npm/l/vadivam-solid?style=flat-square&color=111)](https://github.com/praveenjuge/vadivam/blob/main/LICENSE)

![All Vadivam icons](https://raw.githubusercontent.com/praveenjuge/vadivam/main/apps/docs/public/preview.png?v=0.0.74)

```sh
npm install vadivam-solid
```

```tsx
import { Activity, VadivamProvider } from "vadivam-solid";

<VadivamProvider size={20} color="navy">
  <Activity />
</VadivamProvider>;
```

- Native SVG attributes plus size, color, stroke width, and accessible titles
- Tree-shakeable named and per-icon imports
- Provider and typed dynamic icon APIs

Every icon also has a solid twin with the same name in `vadivam-solid/solid`. Solid icons fill their shapes with `color` and take no stroke props:

```js
import { Activity } from "vadivam-solid/solid";
```

Package family: [SVG and JavaScript](https://www.npmjs.com/package/vadivam) · [React](https://www.npmjs.com/package/vadivam-react) · [React Native](https://www.npmjs.com/package/vadivam-react-native) · [Vue](https://www.npmjs.com/package/vadivam-vue) · [Svelte](https://www.npmjs.com/package/vadivam-svelte) · [Angular](https://www.npmjs.com/package/vadivam-angular) · [Astro](https://www.npmjs.com/package/vadivam-astro) · [Preact](https://www.npmjs.com/package/vadivam-preact) · [Qwik](https://www.npmjs.com/package/vadivam-qwik) · [Lit](https://www.npmjs.com/package/vadivam-lit) · [Flutter](https://pub.dev/packages/vadivam) · [Jetpack Compose](https://central.sonatype.com/artifact/com.praveenjuge/vadivam-compose) · [MCP server](https://www.npmjs.com/package/vadivam-mcp)

[Issues](https://github.com/praveenjuge/vadivam/issues)
