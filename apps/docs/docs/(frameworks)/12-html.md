---
title: HTML and htmx
description: Add Vadivam icons to plain HTML, htmx, Alpine, or any framework with the <vadivam-icon> custom element and one script tag.
seo:
  title: Web Component Icons for HTML and htmx
related:
  - /docs/core
  - /docs/lit
  - /docs/dynamic-icons
search:
  keywords: [web components, custom element, vadivam-icon, htmx, alpine, cdn, script tag, vanilla]
---

The core `vadivam` package includes `<vadivam-icon>`, a custom element that works anywhere HTML does: static pages, server templates, htmx, Alpine, and frameworks that render custom elements.

## Load it

From a CDN, with no build step:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/vadivam/dist/elements.js"></script>
```

Or from the package in a bundled app:

```sh
npm install vadivam
```

```js
import "vadivam/elements";
```

The script registers the element once. Each icon is a separate small module, loaded the first time a page uses it.

## Use it

```html
<vadivam-icon name="activity"></vadivam-icon>
<vadivam-icon name="search" size="20" color="navy" stroke-width="1.5"></vadivam-icon>
<button>
  <vadivam-icon name="trash" label="Delete"></vadivam-icon>
</button>
```

| Attribute               | Default        | Notes                                                        |
| ----------------------- | -------------- | ------------------------------------------------------------ |
| `name`                  |                | Kebab-case icon name, such as `arrow-right`.                 |
| `size`                  | `24`           | A number of pixels or a CSS length, such as `1em`.           |
| `color`                 | `currentColor` | Stroke color. External `url()` paint is ignored.             |
| `stroke-width`          | `2`            | Stroke width in view-box units.                              |
| `absolute-stroke-width` | off            | Keeps the stroke the same width in pixels at any size.       |
| `label`                 |                | Accessible name. Without it the icon is hidden from screen readers. |

Changing an attribute, including `name`, re-renders the icon, so htmx swaps and Alpine bindings work without extra setup.

## Style it

The SVG lives in a shadow root and inherits `color` from the page. Size the element with CSS, which overrides the `size` attribute, and reach the SVG itself through its `svg` part:

```css
vadivam-icon {
  width: 1.25em;
  height: 1.25em;
  color: var(--accent);
}

vadivam-icon::part(svg) {
  stroke-width: 1.5;
}
```

The element reserves its size before the icon loads, so the layout doesn't shift.

## Other options

For server-rendered markup with no JavaScript at all, use [SVG strings, the sprite, or the icon font](/docs/core). For Lit components, use [vadivam-lit](/docs/lit), which renders inline SVG templates.
