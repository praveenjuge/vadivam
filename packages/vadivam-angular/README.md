# vadivam-angular

Pixel-perfect 24px outline icon directives for Angular with tree-shakeable imports.

[![npm version](https://img.shields.io/npm/v/vadivam-angular?style=flat-square&color=111)](https://www.npmjs.com/package/vadivam-angular)
[![downloads](https://img.shields.io/npm/dw/vadivam-angular?style=flat-square&color=666)](https://www.npmjs.com/package/vadivam-angular)
[![license](https://img.shields.io/npm/l/vadivam-angular?style=flat-square&color=111)](https://github.com/praveenjuge/vadivam/blob/main/LICENSE)

![All Vadivam icons](https://raw.githubusercontent.com/praveenjuge/vadivam/main/apps/docs/public/preview.png?v=0.0.26)

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

[Browse icons](https://vadivam.praveenjuge.com) · [GitHub](https://github.com/praveenjuge/vadivam) · [Issues](https://github.com/praveenjuge/vadivam/issues)
