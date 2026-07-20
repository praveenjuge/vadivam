---
title: React
description: Use free, open-source Vadivam SVG icon components with tree-shakeable imports in React applications.
seo:
  title: React Icons – 24px Outline Icon Components
---

`vadivam-react` supports React 18 and newer and renders native `<svg>` elements.

```sh
npm install vadivam-react
```

## Basic usage

```tsx
import { Activity } from "vadivam-react";

export function Status() {
  return (
    <Activity
      size={20}
      color="currentColor"
      strokeWidth={2}
      aria-label="Activity"
    />
  );
}
```

Icons accept React SVG props plus `size`, `color`, `strokeWidth`, `absoluteStrokeWidth`, and `title`. Components forward a ref to the root `SVGSVGElement` and may contain children.

```tsx
import { useRef } from "react";
import { Activity } from "vadivam-react";

export function FocusableIcon() {
  const ref = useRef<SVGSVGElement>(null);
  return <Activity ref={ref} tabIndex={-1} title="Activity" />;
}
```

## Shared defaults

```tsx
import { Activity, Search, VadivamProvider } from "vadivam-react";

export function Toolbar() {
  return (
    <VadivamProvider size={20} color="navy" strokeWidth={1.5}>
      <Activity />
      <Search color="tomato" />
    </VadivamProvider>
  );
}
```

The provider accepts `size`, `color`, `strokeWidth`, `absoluteStrokeWidth`, and `className`. An icon's own props override provider values.

## Per-icon imports

```tsx
import Activity from "vadivam-react/activity";
// Also supported:
import Search from "vadivam-react/icons/search";
```

The root package also exports the generic `Icon`, `createIcon`/`createVadivamIcon`, icon nodes, and related TypeScript types for advanced custom-icon use.

## Runtime names

```tsx
import { DynamicIcon } from "vadivam-react/dynamic";

<DynamicIcon name="activity" size={20} fallback={null} />;
```

`DynamicIcon` loads the per-icon module and accepts the normal icon props plus `name` and an optional `fallback`. See [Dynamic icons](/docs/dynamic-icons) and [accessibility guidance](/docs/usage#accessibility).
