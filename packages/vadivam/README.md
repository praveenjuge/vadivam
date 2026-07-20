# vadivam

Tree-shakeable 24px outline SVG icons for JavaScript, with raw assets and metadata.

[Browse icons](https://vadivam.praveenjuge.com) · [Core docs](https://vadivam.praveenjuge.com/docs/core) · [Source](https://github.com/praveenjuge/vadivam/tree/main/packages/vadivam) · [GitHub](https://github.com/praveenjuge/vadivam)

[![npm version](https://img.shields.io/npm/v/vadivam?style=flat-square&color=111)](https://www.npmjs.com/package/vadivam)
[![downloads](https://img.shields.io/npm/dw/vadivam?style=flat-square&color=666)](https://www.npmjs.com/package/vadivam)
[![license](https://img.shields.io/npm/l/vadivam?style=flat-square&color=111)](https://github.com/praveenjuge/vadivam/blob/main/LICENSE)

![All Vadivam icons](https://raw.githubusercontent.com/praveenjuge/vadivam/main/apps/docs/public/preview.png?v=0.0.27)

```sh
npm install vadivam
```

```js
import { Activity, createElement } from "vadivam";
import activitySvgUrl from "vadivam/icons/activity.svg";
import activitySvg from "vadivam/strings/activity";

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
- Per-icon SVG strings, a complete SVG sprite, and an optional WOFF2 icon font
- DOM replacement with configurable attributes, roots, and templates
- Complete icon metadata from `vadivam/manifest`

Package family: [React](https://www.npmjs.com/package/vadivam-react) · [React Native](https://www.npmjs.com/package/vadivam-react-native) · [Vue](https://www.npmjs.com/package/vadivam-vue) · [Svelte](https://www.npmjs.com/package/vadivam-svelte) · [Solid](https://www.npmjs.com/package/vadivam-solid) · [Angular](https://www.npmjs.com/package/vadivam-angular) · [Astro](https://www.npmjs.com/package/vadivam-astro) · [Preact](https://www.npmjs.com/package/vadivam-preact)

[Issues](https://github.com/praveenjuge/vadivam/issues)
