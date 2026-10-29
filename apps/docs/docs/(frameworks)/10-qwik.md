---
title: Qwik
description: Use free, open-source Vadivam SVG icon components in Qwik that render on the server and ship no client JavaScript.
seo:
  title: Qwik Icons – 24px Outline Icon Components
related:
  - /docs/usage
  - /docs/accessibility
  - /docs/html
search:
  keywords: [qwik city, resumable, ssr, jsx]
---

`vadivam-qwik` supports Qwik 2 (`@qwik.dev/core`). Icons are inline components: plain functions that render during server rendering and add no JavaScript to the client.

```sh
npm install vadivam-qwik
```

## Basic usage

```tsx
import { component$ } from "@qwik.dev/core";
import { Activity } from "vadivam-qwik";

export const Status = component$(() => {
  return <Activity size={20} color="navy" strokeWidth={1.5} title="Activity" />;
});
```

Icons accept Qwik SVG attributes plus `size`, `color`, `strokeWidth`, `absoluteStrokeWidth`, and `title`. Event handlers such as `onClick$` pass through to the `<svg>`.

There is no provider: inline components can't read context. Set shared defaults with CSS on the `vadivam` class, or wrap an icon in your own component.

The root entry point also exports the `icons` registry, a generic `Icon`, `createVadivamIcon`, and icon nodes for advanced use.

## Per-icon imports

```ts
import Activity from "vadivam-qwik/activity";
import Search from "vadivam-qwik/icons/search";
```

## Runtime names

Qwik already loads code on demand, so `vadivam-qwik` has no `DynamicIcon`. For a name that comes from data, look the component up in the `icons` registry by its PascalCase name:

```tsx
import { icons } from "vadivam-qwik";

const Icon = icons.ArrowRight;
<Icon size={20} />;
```

Importing `icons` keeps every icon reachable, so prefer named imports when the icon is known. See [Usage](/docs/usage) and [Accessibility](/docs/accessibility).
