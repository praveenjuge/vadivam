---
title: Vue
description: Render Vadivam SVG components with shared defaults and dynamic names in Vue 3.
---

`vadivam-vue` supports Vue 3.5 and renders native SVG components.

```sh
npm install vadivam-vue
```

## Basic usage

```vue
<script setup lang="ts">
import { Activity } from "vadivam-vue";
</script>

<template>
  <Activity :size="20" color="navy" :stroke-width="1.5" title="Activity" />
</template>
```

Components accept Vue SVG attributes plus `size`, `color`, `strokeWidth`, `absoluteStrokeWidth`, and `title`. In templates, either kebab-case bindings such as `:stroke-width` or the corresponding prop names may be used according to Vue conventions.

## Shared defaults

```vue
<script setup lang="ts">
import { Activity, Search, VadivamProvider } from "vadivam-vue";
</script>

<template>
  <VadivamProvider :size="20" color="navy" :stroke-width="1.5">
    <Activity />
    <Search color="tomato" />
  </VadivamProvider>
</template>
```

For composition-based setup code, the root package also exports `provideVadivam` and `useVadivamContext`.

## Per-icon imports

```ts
import Activity from "vadivam-vue/activity";
import Search from "vadivam-vue/icons/search";
```

## Runtime names

```vue
<script setup lang="ts">
import { DynamicIcon } from "vadivam-vue/dynamic";
</script>

<template>
  <DynamicIcon name="activity" :size="20" title="Activity" />
</template>
```

The `/dynamic` entry point also exports `iconNames` and `dynamicIconImports`. Use static imports for names known in source and read [Dynamic icons](/docs/dynamic-icons) before accepting arbitrary runtime strings. See [Usage, styling, and accessibility](/docs/usage) for shared SVG guidance.
