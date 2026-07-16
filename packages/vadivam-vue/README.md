# vadivam-vue

Pixel-perfect, open-source Vadivam icons for Vue.

![All Vadivam icons](https://raw.githubusercontent.com/praveenjuge/vadivam/main/apps/web/public/preview.png?v=0.0.19)

```sh
bun add vadivam-vue
```

```vue
<script setup>
import { Activity, VadivamProvider } from "vadivam-vue";
</script>

<template><VadivamProvider :size="20" color="navy"><Activity /></VadivamProvider></template>
```

Icons accept native SVG attributes plus `size`, `color`, `strokeWidth`,
`absoluteStrokeWidth`, and `title`. Static named and per-icon imports are
tree-shakeable. For data-driven names, use `DynamicIcon` from
`vadivam-vue/dynamic` and `dynamicIconImports` from
`vadivam-vue/dynamicIconImports`.
