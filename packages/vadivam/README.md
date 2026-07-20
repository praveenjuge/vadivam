# vadivam

Pixel-perfect 24px outline SVG icons with tree-shakeable ESM imports and metadata.

[![npm version](https://img.shields.io/npm/v/vadivam?style=flat-square&color=111)](https://www.npmjs.com/package/vadivam)
[![downloads](https://img.shields.io/npm/dw/vadivam?style=flat-square&color=666)](https://www.npmjs.com/package/vadivam)
[![license](https://img.shields.io/npm/l/vadivam?style=flat-square&color=111)](https://github.com/praveenjuge/vadivam/blob/main/LICENSE)

![All Vadivam icons](https://raw.githubusercontent.com/praveenjuge/vadivam/main/apps/docs/public/preview.png?v=0.0.24)

```sh
npm install vadivam
```

```js
import { Activity, createElement } from "vadivam";
import activitySvgUrl from "vadivam/icons/activity.svg";

const svg = createElement(Activity, { width: 20, height: 20 });
```

Replace elements in HTML with the DOM helper:

```html
<i data-vadivam="activity" aria-label="Activity"></i>
```

```js
import { createIcons, icons } from "vadivam";

createIcons({ icons });
```

- Tree-shakeable icon nodes and direct SVG asset imports
- DOM replacement with configurable attributes, roots, and templates
- Complete icon metadata from `vadivam/manifest`

[Browse icons](https://vadivam.praveenjuge.com) · [GitHub](https://github.com/praveenjuge/vadivam) · [Issues](https://github.com/praveenjuge/vadivam/issues)
