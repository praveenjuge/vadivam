# vadivam-angular

Tree-shakeable 24px outline SVG icon directives for Angular.

[Browse icons](https://vadivam.praveenjuge.com) · [Angular docs](https://vadivam.praveenjuge.com/docs/angular) · [Source](https://github.com/praveenjuge/vadivam/tree/main/packages/vadivam-angular) · [GitHub](https://github.com/praveenjuge/vadivam)

[![npm version](https://img.shields.io/npm/v/vadivam-angular?style=flat-square&color=111)](https://www.npmjs.com/package/vadivam-angular)
[![downloads](https://img.shields.io/npm/dw/vadivam-angular?style=flat-square&color=666)](https://www.npmjs.com/package/vadivam-angular)
[![license](https://img.shields.io/npm/l/vadivam-angular?style=flat-square&color=111)](https://github.com/praveenjuge/vadivam/blob/main/LICENSE)

![All Vadivam icons](https://raw.githubusercontent.com/praveenjuge/vadivam/main/apps/docs/public/preview.png?v=0.0.30)

```sh
npm install vadivam-angular
```

```ts
import { Component } from "@angular/core";
import { Activity } from "vadivam-angular";

@Component({
  imports: [Activity],
  template: '<svg vadivamActivity size="20" color="navy"></svg>',
})
export class Example {}
```

- Native SVG attributes plus size, color, stroke width, and accessible titles
- Tree-shakeable named and per-icon imports
- Static directives and typed dynamic icon APIs

Package family: [SVG and JavaScript](https://www.npmjs.com/package/vadivam) · [React](https://www.npmjs.com/package/vadivam-react) · [React Native](https://www.npmjs.com/package/vadivam-react-native) · [Vue](https://www.npmjs.com/package/vadivam-vue) · [Svelte](https://www.npmjs.com/package/vadivam-svelte) · [Solid](https://www.npmjs.com/package/vadivam-solid) · [Astro](https://www.npmjs.com/package/vadivam-astro) · [Preact](https://www.npmjs.com/package/vadivam-preact)

[Issues](https://github.com/praveenjuge/vadivam/issues)
