---
title: Accessibility
description: Hide decorative Vadivam icons from assistive technology and give meaningful icons an accessible name in every framework, including React Native.
related:
  - /docs/usage
  - /docs/react-native
  - /docs/design-guide
search:
  keywords: [accessibility, a11y, aria-label, aria-hidden, title, screen reader, accessibilityLabel]
---

An icon is either decorative or meaningful. It is decorative when it repeats nearby text, such as an icon next to a button label. It is meaningful when it carries information on its own, such as an icon-only button or a status indicator.

## Decorative icons

An icon that repeats adjacent text should be hidden from assistive technology:

```tsx
<button type="button">
  <Activity aria-hidden="true" />
  Activity
</button>
```

Web framework components are decorative by default when no title or accessible attribute is provided. Supplying `aria-hidden` explicitly still makes intent clear and is useful when reviewing a control. The core `createIcons` helper also adds `aria-hidden="true"` to unlabeled placeholders; `createElement` does not, so label or hide its result yourself.

## Meaningful icons

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

## Don't rely on shape or color alone

An icon's shape or color should not be the only way a state is shown. Pair a status icon with text, or give it an accessible name that states the status, such as "Build failed" rather than "Red X".
