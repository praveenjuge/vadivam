# vadivam-vue

Pixel-perfect 24px outline icon components for Vue with tree-shakeable imports.

[![npm version](https://img.shields.io/npm/v/vadivam-vue?style=flat-square&color=111)](https://www.npmjs.com/package/vadivam-vue)
[![downloads](https://img.shields.io/npm/dw/vadivam-vue?style=flat-square&color=666)](https://www.npmjs.com/package/vadivam-vue)
[![license](https://img.shields.io/npm/l/vadivam-vue?style=flat-square&color=111)](https://github.com/praveenjuge/vadivam/blob/main/LICENSE)

![All Vadivam icons](https://raw.githubusercontent.com/praveenjuge/vadivam/main/apps/docs/public/preview.png?v=0.0.26)

```sh
npm install vadivam-vue
```

```vue
<script setup>
import { Activity, VadivamProvider } from "vadivam-vue";
</script>

<template>
  <VadivamProvider :size="20" color="navy"><Activity /></VadivamProvider>
</template>
```

- Native SVG attributes plus size, color, stroke width, and accessible titles
- Tree-shakeable named and per-icon imports
- Provider and typed dynamic icon APIs

[Browse icons](https://vadivam.praveenjuge.com) · [GitHub](https://github.com/praveenjuge/vadivam) · [Issues](https://github.com/praveenjuge/vadivam/issues)
