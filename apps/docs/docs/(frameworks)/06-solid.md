---
title: Solid
description: Use free, open-source Vadivam SVG icon components in Solid applications with shared defaults, per-icon imports, and runtime names.
seo:
  title: Solid Icons – 24px Outline Icon Components
related:
  - /docs/usage
  - /docs/dynamic-icons
  - /docs/installation
search:
  keywords: [solidjs, solidstart]
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

## Solid icons

Every icon has a [solid](/docs/design-guide#solid) twin with the same name in `vadivam-solid/solid`. The second `solid` is the icon style, not the framework:

```tsx
import { Show } from "solid-js";
import { House } from "vadivam-solid";
import { House as HouseSolid } from "vadivam-solid/solid";

export function HomeTab(props: { active: boolean }) {
  return (
    <Show when={props.active} fallback={<House size={20} title="Home" />}>
      <HouseSolid size={20} title="Home" />
    </Show>
  );
}
```

Solid icons fill their shapes with `color` and have no stroke props. `VadivamProvider` sets defaults for both styles, and `vadivam-solid/solid/icons/house` and `vadivam-solid/solid/dynamic` work like their outline counterparts.

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

Use static imports for names known in source. See [Dynamic icons](/docs/dynamic-icons), [Usage](/docs/usage), and [Accessibility](/docs/accessibility).
