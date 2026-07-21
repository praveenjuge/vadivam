---
title: Usage, styling, and accessibility
description: Size, color, style, and label Vadivam icons consistently across supported frameworks.
---

Vadivam icons use a `24 24` view box, no fill, `currentColor`, a default stroke width of `2`, and round line caps and joins. Framework packages expose the same visual controls while forwarding native SVG attributes.

## Size and color

```tsx
import { Activity } from "vadivam-react";

<Activity size={20} color="rebeccapurple" strokeWidth={1.5} />;
```

`size` sets both width and height. `color` sets the SVG stroke. Because the default is `currentColor`, icons naturally inherit CSS text color:

```tsx
<Activity className="status-icon" />
```

```css
.status-icon {
  color: #2563eb;
  width: 1.25rem;
  height: 1.25rem;
}
```

Use the native spelling expected by the framework: for example, `className` in React and `class` in Vue, Svelte, Solid, Astro, and Preact. For raw DOM helper attributes, use SVG attribute names such as `stroke-width`.

## Absolute stroke width

Normally, scaling an SVG also scales its visible stroke. Set `absoluteStrokeWidth` when the stroke should remain visually close to the requested `strokeWidth` at another icon size:

```tsx
<Activity size={48} strokeWidth={2} absoluteStrokeWidth />
```

This prop is available in all component and directive packages. It is not an option of the core `createElement` helper; set the resulting SVG attributes directly when using the core package.

## Shared defaults

React, React Native, Vue, Svelte, Solid, and Preact provide a `VadivamProvider`. Provider values are defaults and can be overridden by an individual icon:

```tsx
import { Activity, Search, VadivamProvider } from "vadivam-react";

<VadivamProvider size={20} color="navy" strokeWidth={1.5}>
  <Activity />
  <Search color="tomato" />
</VadivamProvider>;
```

Angular uses `provideVadivamConfig` instead. Astro has no provider API; pass props to each component.

## Accessibility

### Decorative icons

An icon that repeats adjacent text should be hidden from assistive technology:

```tsx
<button type="button">
  <Activity aria-hidden="true" />
  Activity
</button>
```

Web framework components are decorative by default when no title or accessible attribute is provided. Supplying `aria-hidden` explicitly still makes intent clear and is useful when reviewing a control. The core `createIcons` helper also adds `aria-hidden="true"` to unlabeled placeholders; `createElement` does not, so label or hide its result yourself.

### Meaningful icons

If an icon conveys information not present as visible text, give it an accessible name:

```tsx
<Activity role="img" aria-label="Service is active" />
```

Framework components also support a `title` prop, which inserts an SVG `<title>` and marks the icon as an image:

```tsx
<Activity title="Service is active" />
```

For React Native, use native accessibility props such as `accessibilityLabel`:

```tsx
<Activity accessibilityLabel="Service is active" accessible />
```

Prefer visible text for primary actions. An icon-only button needs a name on the button itself:

```tsx
<button type="button" aria-label="Search">
  <Search aria-hidden="true" />
</button>
```

## Static imports first

```ts
import { Search } from "vadivam-react";
```

Static imports are easiest for bundlers to tree-shake and do not add an asynchronous loading state. If the name comes from a database, CMS, or user configuration, use the [dynamic icon APIs](/docs/dynamic-icons).
