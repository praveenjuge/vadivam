---
title: Preact
description: Use free, open-source Vadivam SVG icon components, providers, and runtime names in Preact.
seo:
  title: Preact Icons – 24px Outline Icon Components
---

`vadivam-preact` supports Preact 10.29 and renders native SVG components.

```sh
npm install vadivam-preact
```

## Basic usage

```tsx
import { Activity } from "vadivam-preact";

export function Status() {
  return <Activity size={20} color="navy" strokeWidth={1.5} title="Activity" />;
}
```

Icons accept Preact SVG attributes plus `size`, `color`, `strokeWidth`, `absoluteStrokeWidth`, and `title`.

## Shared defaults

```tsx
import { Activity, Search, VadivamProvider } from "vadivam-preact";

export function Toolbar() {
  return (
    <VadivamProvider size={20} color="navy" strokeWidth={1.5}>
      <Activity />
      <Search color="tomato" />
    </VadivamProvider>
  );
}
```

The root entry point also exports `useVadivamContext`, a generic `Icon`, `createVadivamIcon`, and icon nodes for advanced use.

## Per-icon imports

```ts
import Activity from "vadivam-preact/activity";
import Search from "vadivam-preact/icons/search";
```

## Runtime names

```tsx
import { DynamicIcon } from "vadivam-preact/dynamic";

<DynamicIcon name="activity" size={20} fallback={null} />;
```

The `/dynamic` entry point exports `DynamicIcon`, `iconNames`, and `dynamicIconImports`. Dynamic components accept normal icon props, a kebab-case `name`, and optional Preact children as a fallback.

Use static imports for known names. See [Dynamic icons](/docs/dynamic-icons) and [Usage, styling, and accessibility](/docs/usage).
