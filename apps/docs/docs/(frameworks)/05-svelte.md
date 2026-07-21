---
title: Svelte
description: Use free, open-source Vadivam SVG icon components with providers and dynamic imports in Svelte 5.
seo:
  title: Svelte Icons – 24px Outline Icon Components
---

`vadivam-svelte` supports Svelte 5.56 and newer within the Svelte 5 release line.

```sh
npm install vadivam-svelte
```

## Basic usage

```svelte
<script lang="ts">
  import { Activity } from "vadivam-svelte";
</script>

<Activity size={20} color="navy" strokeWidth={1.5} title="Activity" />
```

Components accept Svelte SVG attributes plus `size`, `color`, `strokeWidth`, `absoluteStrokeWidth`, `title`, and optional child content.

## Shared defaults

```svelte
<script lang="ts">
  import { Activity, Search, VadivamProvider } from "vadivam-svelte";
</script>

<VadivamProvider size={20} color="navy" strokeWidth={1.5}>
  <Activity />
  <Search color="tomato" />
</VadivamProvider>
```

The root package also exports `setVadivamProps` and `getVadivamContext` for custom context integration.

## Per-icon imports

```ts
import Activity from "vadivam-svelte/activity";
import Search from "vadivam-svelte/icons/search";
```

## Runtime names

Svelte's `/dynamic` entry point is a default component export:

```svelte
<script lang="ts">
  import DynamicIcon from "vadivam-svelte/dynamic";
</script>

<DynamicIcon name="activity" size={20} title="Activity" />
```

The fallback prop is a Svelte snippet. The `iconNames` list and lazy import map are exported from `vadivam-svelte/dynamicIconImports`, not from the default dynamic component module.

Use static imports for known names. See [Dynamic icons](/docs/dynamic-icons) and [Usage, styling, and accessibility](/docs/usage).
