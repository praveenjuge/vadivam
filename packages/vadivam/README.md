# vadivam

Tree-shakeable 24px outline and solid SVG icons for JavaScript, with raw assets and metadata.

[Browse icons](https://vadivam.praveenjuge.com) · [Core docs](https://vadivam.praveenjuge.com/docs/core) · [Source](https://github.com/praveenjuge/vadivam/tree/main/packages/vadivam) · [GitHub](https://github.com/praveenjuge/vadivam)

[![npm version](https://img.shields.io/npm/v/vadivam?style=flat-square&color=111)](https://www.npmjs.com/package/vadivam)
[![downloads](https://img.shields.io/npm/dw/vadivam?style=flat-square&color=666)](https://www.npmjs.com/package/vadivam)
[![license](https://img.shields.io/npm/l/vadivam?style=flat-square&color=111)](https://github.com/praveenjuge/vadivam/blob/main/LICENSE)

![All Vadivam icons](https://raw.githubusercontent.com/praveenjuge/vadivam/main/apps/docs/public/preview.png?v=0.0.74)

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
- A codemod that moves a Lucide project to Vadivam: `npx vadivam migrate-lucide --write` ([guide](https://vadivam.praveenjuge.com/docs/migrate-from-lucide))

Every icon also has a solid twin with the same name in `vadivam/solid`, with its own strings, sprite, and DOM helpers, plus the `vadivam/font/vadivam-solid.css` icon font:

```js
import { Activity, createElement } from "vadivam/solid";
```

Package family: [React](https://www.npmjs.com/package/vadivam-react) · [React Native](https://www.npmjs.com/package/vadivam-react-native) · [Vue](https://www.npmjs.com/package/vadivam-vue) · [Svelte](https://www.npmjs.com/package/vadivam-svelte) · [Solid](https://www.npmjs.com/package/vadivam-solid) · [Angular](https://www.npmjs.com/package/vadivam-angular) · [Astro](https://www.npmjs.com/package/vadivam-astro) · [Preact](https://www.npmjs.com/package/vadivam-preact) · [Qwik](https://www.npmjs.com/package/vadivam-qwik) · [Lit](https://www.npmjs.com/package/vadivam-lit) · [Flutter](https://pub.dev/packages/vadivam) · [Jetpack Compose](https://central.sonatype.com/artifact/com.praveenjuge/vadivam-compose) · [MCP server](https://www.npmjs.com/package/vadivam-mcp)

[Issues](https://github.com/praveenjuge/vadivam/issues)
