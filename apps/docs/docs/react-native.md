---
title: React Native
description: Use free, open-source Vadivam icon components with React Native and Expo through react-native-svg.
seo:
  title: React Native and Expo Icons – 24px Outline Components
---

`vadivam-react-native` renders native SVG elements through `react-native-svg`. It supports React Native 0.71+, React 18–19, and `react-native-svg` 12–15.

```sh
npm install vadivam-react-native react-native-svg
```

In Expo projects, install `react-native-svg` with Expo's version-aware installer when appropriate:

```sh
npx expo install react-native-svg
npm install vadivam-react-native
```

## Basic usage

```tsx
import { Activity } from "vadivam-react-native";

export function Status() {
  return (
    <Activity
      size={20}
      color="navy"
      strokeWidth={2}
      accessible
      accessibilityLabel="Activity"
    />
  );
}
```

Icons accept `react-native-svg`'s `SvgProps` plus `size`, `absoluteStrokeWidth`, `title`, and `data-testid`. A forwarded ref targets the root `Svg` instance.

## Shared defaults

```tsx
import { Activity, Search, VadivamProvider } from "vadivam-react-native";

<VadivamProvider size={20} color="navy" strokeWidth={1.5}>
  <Activity />
  <Search color="tomato" />
</VadivamProvider>;
```

The provider supplies `size`, `color`, `strokeWidth`, and `absoluteStrokeWidth`. Individual icon props take precedence.

## Per-icon and dynamic imports

```tsx
import Activity from "vadivam-react-native/activity";
import { DynamicIcon } from "vadivam-react-native/dynamic";

<Activity size={20} />;
<DynamicIcon name="search" size={20} fallback={null} />;
```

The package also exposes `/icons`, `/icons/*`, and `/dynamicIconImports` entries. Dynamic names are kebab-case and load per-icon modules; use static imports when names are known in source.

React Native accessibility uses platform props rather than web ARIA. Add `accessible` and `accessibilityLabel` when the icon itself conveys meaning, or hide/reduce duplicate announcements when adjacent text already names the control. See [common accessibility guidance](/docs/usage#accessibility) and [Dynamic icons](/docs/dynamic-icons).
