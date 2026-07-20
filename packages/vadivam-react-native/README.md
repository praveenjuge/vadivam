# vadivam-react-native

Tree-shakeable 24px outline icons for React Native and Expo, powered by react-native-svg.

[Browse icons](https://vadivam.praveenjuge.com) · [React Native docs](https://vadivam.praveenjuge.com/docs/react-native) · [Source](https://github.com/praveenjuge/vadivam/tree/main/packages/vadivam-react-native) · [GitHub](https://github.com/praveenjuge/vadivam)

[![npm version](https://img.shields.io/npm/v/vadivam-react-native?style=flat-square&color=111)](https://www.npmjs.com/package/vadivam-react-native)
[![downloads](https://img.shields.io/npm/dw/vadivam-react-native?style=flat-square&color=666)](https://www.npmjs.com/package/vadivam-react-native)
[![license](https://img.shields.io/npm/l/vadivam-react-native?style=flat-square&color=111)](https://github.com/praveenjuge/vadivam/blob/main/LICENSE)

![All Vadivam icons](https://raw.githubusercontent.com/praveenjuge/vadivam/main/apps/docs/public/preview.png?v=0.0.26)

```sh
npm install vadivam-react-native react-native-svg
```

```tsx
import { Activity } from "vadivam-react-native";

export function Example() {
  return <Activity size={20} color="navy" strokeWidth={2} />;
}
```

Apply shared defaults with the provider:

```tsx
import { Activity, VadivamProvider } from "vadivam-react-native";

<VadivamProvider size={20} color="navy" strokeWidth={1.5}>
  <Activity />
</VadivamProvider>;
```

For data-driven names, use the dynamic entry point:

```tsx
import { DynamicIcon } from "vadivam-react-native/dynamic";

<DynamicIcon name="activity" />;
```

- Native `react-native-svg` properties, refs, and children
- Tree-shakeable named, aliased, and per-icon imports
- Provider, custom-node, and typed dynamic APIs

Package family: [SVG and JavaScript](https://www.npmjs.com/package/vadivam) · [React](https://www.npmjs.com/package/vadivam-react) · [Vue](https://www.npmjs.com/package/vadivam-vue) · [Svelte](https://www.npmjs.com/package/vadivam-svelte) · [Solid](https://www.npmjs.com/package/vadivam-solid) · [Angular](https://www.npmjs.com/package/vadivam-angular) · [Astro](https://www.npmjs.com/package/vadivam-astro) · [Preact](https://www.npmjs.com/package/vadivam-preact)

[Issues](https://github.com/praveenjuge/vadivam/issues)
