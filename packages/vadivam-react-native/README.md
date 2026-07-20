# vadivam-react-native

Pixel-perfect 24px outline icons for React Native and Expo, powered by react-native-svg.

[![npm version](https://img.shields.io/npm/v/vadivam-react-native?style=flat-square&color=111)](https://www.npmjs.com/package/vadivam-react-native)
[![downloads](https://img.shields.io/npm/dw/vadivam-react-native?style=flat-square&color=666)](https://www.npmjs.com/package/vadivam-react-native)
[![license](https://img.shields.io/npm/l/vadivam-react-native?style=flat-square&color=111)](https://github.com/praveenjuge/vadivam/blob/main/LICENSE)

![All Vadivam icons](https://raw.githubusercontent.com/praveenjuge/vadivam/main/apps/docs/public/preview.png?v=0.0.24)

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

[Browse icons](https://vadivam.praveenjuge.com) · [GitHub](https://github.com/praveenjuge/vadivam) · [Issues](https://github.com/praveenjuge/vadivam/issues)
