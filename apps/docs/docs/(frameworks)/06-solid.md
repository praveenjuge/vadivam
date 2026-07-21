---
title: Solid
description: Use free, open-source Vadivam SVG icon components in Solid applications with shared defaults, per-icon imports, and runtime names.
seo:
  title: Solid Icons – 24px Outline Icon Components
---

`vadivam-solid` supports Solid 1.9 and publishes Solid-aware source conditions alongside standard ESM output.

```sh
npm install vadivam-solid
```

## Basic usage

```tsx
import { Activity } from "vadivam-solid";

export function Status() {
  return <Activity size={20} color="navy" strokeWidth={1.5} title="Activity" />;
}
```

Icons accept Solid SVG attributes plus `size`, `color`, `strokeWidth`, `absoluteStrokeWidth`, and `title`.

## Shared defaults

```tsx
import { Activity, Search, VadivamProvider } from "vadivam-solid";

export function Toolbar() {
  return (
    <VadivamProvider size={20} color="navy" strokeWidth={1.5}>
      <Activity />
      <Search color="tomato" />
    </VadivamProvider>
  );
}
```

The root entry point also exports `useVadivamContext`, a generic `Icon`, `createVadivamIcon`, and the icon-node registry for advanced use.

## Per-icon imports

```ts
import Activity from "vadivam-solid/activity";
import Search from "vadivam-solid/icons/search";
```

## Runtime names

```tsx
import { DynamicIcon } from "vadivam-solid/dynamic";

<DynamicIcon name="activity" size={20} fallback={null} />;
```

The dynamic entry point exports `DynamicIcon`, `iconNames`, and `dynamicIconImports`. The component accepts normal icon props plus a kebab-case `name` and optional JSX fallback.

Use static imports for names known in source. See [Dynamic icons](/docs/dynamic-icons) and [Usage, styling, and accessibility](/docs/usage).
