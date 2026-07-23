# vadivam-react

Tree-shakeable 24px outline SVG icons for React.

[Browse icons](https://vadivam.praveenjuge.com) · [React docs](https://vadivam.praveenjuge.com/docs/react) · [Source](https://github.com/praveenjuge/vadivam/tree/main/packages/vadivam-react) · [GitHub](https://github.com/praveenjuge/vadivam)

[![npm version](https://img.shields.io/npm/v/vadivam-react?style=flat-square&color=111)](https://www.npmjs.com/package/vadivam-react)
[![downloads](https://img.shields.io/npm/dw/vadivam-react?style=flat-square&color=666)](https://www.npmjs.com/package/vadivam-react)
[![license](https://img.shields.io/npm/l/vadivam-react?style=flat-square&color=111)](https://github.com/praveenjuge/vadivam/blob/main/LICENSE)

![All Vadivam icons](https://raw.githubusercontent.com/praveenjuge/vadivam/main/apps/docs/public/preview.png?v=0.0.32)

```sh
npm install vadivam-react
```

```tsx
import { Activity } from "vadivam-react";

export function Example() {
  return <Activity size={20} color="currentColor" strokeWidth={2} />;
}
```

Apply shared defaults with the provider:

```tsx
import { Activity, VadivamProvider } from "vadivam-react";

<VadivamProvider size={20} color="navy" strokeWidth={1.5}>
  <Activity />
</VadivamProvider>;
```

Use the dynamic API only for names stored in external data:

```tsx
import { DynamicIcon, iconNames } from "vadivam-react/dynamic";

<DynamicIcon name="activity" />;
```

- Native SVG properties, accessible titles, refs, and children
- Tree-shakeable named, aliased, and per-icon imports
- Provider, generic-node, and typed dynamic APIs

Package family: [SVG and JavaScript](https://www.npmjs.com/package/vadivam) · [React Native](https://www.npmjs.com/package/vadivam-react-native) · [Vue](https://www.npmjs.com/package/vadivam-vue) · [Svelte](https://www.npmjs.com/package/vadivam-svelte) · [Solid](https://www.npmjs.com/package/vadivam-solid) · [Angular](https://www.npmjs.com/package/vadivam-angular) · [Astro](https://www.npmjs.com/package/vadivam-astro) · [Preact](https://www.npmjs.com/package/vadivam-preact)

[Issues](https://github.com/praveenjuge/vadivam/issues)
