---
title: Lit
description: Use free, open-source Vadivam SVG icons in Lit templates, shadow roots, and Lit SSR with tree-shakeable imports.
seo:
  title: Lit Icons – 24px Outline SVG Templates
related:
  - /docs/html
  - /docs/usage
  - /docs/dynamic-icons
search:
  keywords: [lit-html, web components, shadow dom, lit ssr]
---

`vadivam-lit` supports Lit 3. Each icon is a function that returns an SVG template, so it renders inside your own components' shadow roots and with Lit SSR.

```sh
npm install vadivam-lit
```

## Basic usage

```ts
import { LitElement, html } from "lit";
import { Activity } from "vadivam-lit";

class StatusBadge extends LitElement {
  render() {
    return html`${Activity({ size: 20, color: "navy", strokeWidth: 1.5, label: "Activity" })} Online`;
  }
}
customElements.define("status-badge", StatusBadge);
```

Icon functions accept `size`, `color`, `strokeWidth`, `absoluteStrokeWidth`, `class`, and `label`. Without a `label` the icon is hidden from assistive technology.

Lit templates can't spread arbitrary attributes, so put IDs, event listeners, and other attributes on a wrapping element.

The root entry point also exports the `icons` registry, a generic `Icon`, and `createVadivamIcon` for custom geometry.

## Solid icons

Every icon has a [solid](/docs/design-guide#solid) twin with the same name in `vadivam-lit/solid`:

```ts
import { House } from "vadivam-lit";
import { House as HouseSolid } from "vadivam-lit/solid";

html`${(active ? HouseSolid : House)({ size: 20, label: "Home" })}`;
```

Solid icons take `size`, `color`, `class`, and `label`, and `color` sets the fill. They have no stroke, so `strokeWidth` and `absoluteStrokeWidth` don't apply. The solid entry has the same layout as the root: `vadivam-lit/solid/icons/house` and `vadivam-lit/solid/dynamic`.

## Per-icon imports

```ts
import Activity from "vadivam-lit/activity";
import Search from "vadivam-lit/icons/search";
```

## Runtime names

```ts
import { DynamicIcon } from "vadivam-lit/dynamic";

html`${DynamicIcon({ name: "activity", size: 20, fallback: "" })}`;
```

`DynamicIcon` loads the icon with Lit's `until` directive and renders `fallback` until it arrives, or when the name is unknown. The `/dynamic` entry point also exports `iconNames` and `dynamicIconImports`.

Prefer the [`<vadivam-icon>` element](/docs/html) when you only need an icon in plain markup. See [Dynamic icons](/docs/dynamic-icons) and [Accessibility](/docs/accessibility).
