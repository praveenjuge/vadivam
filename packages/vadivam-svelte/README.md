# vadivam-svelte

Pixel-perfect 24px outline icon components for Svelte with tree-shakeable imports.

[![npm version](https://img.shields.io/npm/v/vadivam-svelte?style=flat-square&color=111)](https://www.npmjs.com/package/vadivam-svelte)
[![downloads](https://img.shields.io/npm/dw/vadivam-svelte?style=flat-square&color=666)](https://www.npmjs.com/package/vadivam-svelte)
[![license](https://img.shields.io/npm/l/vadivam-svelte?style=flat-square&color=111)](https://github.com/praveenjuge/vadivam/blob/main/LICENSE)

![All Vadivam icons](https://raw.githubusercontent.com/praveenjuge/vadivam/main/apps/web/public/preview.png?v=0.0.21)

```sh
npm install vadivam-svelte
```

```svelte
<script>
  import { Activity, VadivamProvider } from "vadivam-svelte";
</script>

<VadivamProvider size={20} color="navy"><Activity /></VadivamProvider>
```

- Native SVG attributes plus size, color, stroke width, and accessible titles
- Tree-shakeable named and per-icon imports
- Provider and typed dynamic icon APIs

[Browse icons](https://vadivam.praveenjuge.com) · [GitHub](https://github.com/praveenjuge/vadivam) · [Issues](https://github.com/praveenjuge/vadivam/issues)
