---
title: Core SVG and JavaScript
description: Use the core Vadivam package for optimized SVG assets, icon-node data, catalog metadata, sprites, and browser DOM helpers.
---

The `vadivam` package contains optimized SVG files, serializable icon nodes, catalog metadata, and browser DOM helpers. It has no framework dependency.

```sh
npm install vadivam
```

## SVG assets

Import an optimized SVG through the package export map:

```js
import activitySvgUrl from "vadivam/icons/activity.svg";

const image = document.createElement("img");
image.src = activitySvgUrl;
image.alt = "Activity";
```

How an SVG asset import is represented depends on your bundler. In environments without SVG asset imports, copy or read the exported file using the tooling for that environment.

## SVG strings

Import one icon as complete SVG markup in Node.js, server rendering, static-site generation, or another trusted template:

```js
import activitySvg from "vadivam/strings/activity";

const page = `<main>${activitySvg}</main>`;
```

Each subpath contains only its requested icon. The string is generated from the same validated SVG used by every Vadivam package. Do not concatenate untrusted attributes or content into the markup.

## SVG sprite

The complete sprite is available as an asset URL:

```js
import spriteUrl from "vadivam/sprite.svg";

document.querySelector("#activity use").setAttribute(
  "href",
  `${spriteUrl}#vadivam-activity`,
);
```

```html
<svg
  id="activity"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <use></use>
</svg>
```

Serve or copy `sprite.svg` from the same origin when using an external `<use>`. The sprite contains every icon, so prefer per-icon imports when download size matters.

## Icon font

Import the stylesheet through a bundler:

```js
import "vadivam/font/vadivam.css";
```

Or load the published stylesheet from a CDN:

```html
<link
  rel="stylesheet"
  href="https://unpkg.com/vadivam@latest/dist/font/vadivam.css"
/>
```

Then apply the base class and icon class together:

```html
<i
  class="vadivam-icon vadivam-icon-activity"
  aria-hidden="true"
></i>
```

The font is WOFF2-only and contains the complete icon set. Icon fonts are best for CSS-based or legacy integrations; SVG imports provide better accessibility and load only the icons an application uses. Keep decorative font icons hidden from assistive technology. For a meaningful icon, provide an accessible name on its surrounding control or include equivalent visible text.

## Icon nodes

Named exports are icon-node arrays, not DOM elements or SVG strings:

```js
import { Activity, createElement } from "vadivam";

const svg = createElement(Activity, {
  width: 20,
  height: 20,
  "aria-label": "Activity",
});

document.querySelector("#status")?.append(svg);
```

`createElement(iconNode, attributes?)` returns an `SVGElement` and requires a browser `document`. Its defaults are a `24` by `24` view box, no fill, `currentColor`, a stroke width of `2`, and round caps and joins.

A direct per-icon node import avoids the root index:

```js
import Activity from "vadivam/icons/activity";
```

## Replace placeholders

`createIcons` replaces elements carrying a marker attribute:

```html
<i data-vadivam="activity" aria-label="Activity"></i>
<i data-vadivam="search" aria-hidden="true"></i>
```

```js
import { Activity, Search, createIcons } from "vadivam";

createIcons({
  icons: { Activity, Search },
});
```

The default marker is `data-vadivam`. The helper converts its kebab-case value to the matching PascalCase key in the supplied `icons` object. Replaced SVGs receive `vadivam` and `vadivam-{name}` classes. If the placeholder has no accessible attribute, role, or title, the helper adds `aria-hidden="true"`.

Pass the complete icon-node registry when bundle size is not a concern:

```js
import { createIcons, icons } from "vadivam";

createIcons({ icons });
```

Importing the complete `icons` registry makes all icon nodes reachable. Prefer a small object when only a known subset is needed.

### Options

```js
createIcons({
  icons: { Activity },
  nameAttr: "data-icon",
  attrs: { width: 20, height: 20, class: "app-icon" },
  root: document.querySelector("main"),
  inTemplates: true,
});
```

`root` may be an `Element`, `Document`, or `DocumentFragment`. Set `inTemplates` to recurse into `<template>` contents. Placeholder attributes override attributes supplied through `attrs`.

## Manifest and metadata

Use `vadivam/manifest` to inspect the complete catalog:

```ts
import { iconNames, icons, iconsByName } from "vadivam/manifest";

console.log(iconNames.includes("activity"));
console.log(iconsByName.activity.componentName); // "Activity"
console.log(icons[0].svg);
```

Each metadata record includes `name`, `componentName`, `fileName`, `svgPath`, `svg`, and `iconNode`.

The root entry point uses two similar names with different meanings: `icons` is the component-name-to-icon-node registry, while `manifest` is the metadata array. The dedicated `vadivam/manifest` entry point exports its metadata array as `icons`.

Continue with [common usage, styling, and accessibility](/docs/usage).
