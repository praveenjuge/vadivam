---
name: vadivam-icons
description: "Use Vadivam, an open-source set of pixel-perfect 24px outline icons, as SVG assets, SVG strings, a sprite, an icon font, or components for React, React Native, Vue, Svelte, Solid, Angular, Astro, and Preact. Use when a task installs or imports a vadivam package (vadivam, vadivam-react, vadivam-react-native, vadivam-vue, vadivam-svelte, vadivam-solid, vadivam-angular, vadivam-astro, vadivam-preact), sizes, colors, or labels Vadivam icons, renders an icon from a runtime name with DynamicIcon or iconNames, sets shared defaults with VadivamProvider or provideVadivamConfig, or contributes icons to Vadivam."
---

# Vadivam Icons

Vadivam is an open-source set of pixel-perfect 24px outline icons. Use optimized SVG assets, browser JavaScript helpers, or native components for React, React Native, Vue, Svelte, Solid, Angular, Astro, and Preact. Every package is ESM-only and publishes tree-shakeable named and per-icon exports.

## Setup

Install only the package for the environment where the icons render:

```sh
# SVG assets and browser JavaScript
npm install vadivam

# Web frameworks
npm install vadivam-react
npm install vadivam-vue
npm install vadivam-svelte
npm install vadivam-solid
npm install vadivam-angular
npm install vadivam-astro
npm install vadivam-preact

# React Native or Expo
npm install vadivam-react-native react-native-svg
```

Peer ranges: React 18 or newer; React Native 0.71+ with React 18–19 and `react-native-svg` 12–15; Vue 3.5; Svelte 5.56+; Solid 1.9; Angular 22; Astro 7; Preact 10.29. See [Installation](https://vadivam.praveenjuge.com/docs/installation.md).

## Core concepts

- **Names**: icon names are kebab case in data APIs (`activity`, `arrow-right`, `trash-2`) and PascalCase for component imports (`Activity`, `ArrowRight`). [Vadivam](https://vadivam.praveenjuge.com/docs.md)
- **Visual defaults**: a `24 24` view box, no fill, `currentColor`, a stroke width of `2`, and round caps and joins. [Usage](https://vadivam.praveenjuge.com/docs/usage.md)
- **Shared props**: every framework package accepts `size`, `color`, `strokeWidth`, `absoluteStrokeWidth`, and `title` alongside its native SVG attributes. [Usage](https://vadivam.praveenjuge.com/docs/usage.md)
- **Static imports first**: static named imports are tree-shakeable and the best default when the icon is known while writing the application. [Dynamic icons](https://vadivam.praveenjuge.com/docs/dynamic-icons.md)
- **Core icon nodes**: named exports of `vadivam` are icon-node arrays, not DOM elements or SVG strings. [Core SVG and JavaScript](https://vadivam.praveenjuge.com/docs/core.md)

## Common tasks

### Render a known icon

```tsx
import { Activity } from "vadivam-react";

export function Status() {
  return <Activity size={20} aria-label="Activity" />;
}
```

Per-icon imports also work: `import Activity from "vadivam-react/activity";` or `import Search from "vadivam-react/icons/search";`. Use the native spelling for each framework: `className` in React, `class` in Vue, Svelte, Solid, Astro, and Preact. Angular uses `svg[vadivamComponentName]` directives such as `<svg vadivamActivity size="20"></svg>`. See the guide for [React](https://vadivam.praveenjuge.com/docs/react.md), [React Native](https://vadivam.praveenjuge.com/docs/react-native.md), [Vue](https://vadivam.praveenjuge.com/docs/vue.md), [Svelte](https://vadivam.praveenjuge.com/docs/svelte.md), [Solid](https://vadivam.praveenjuge.com/docs/solid.md), [Angular](https://vadivam.praveenjuge.com/docs/angular.md), [Astro](https://vadivam.praveenjuge.com/docs/astro.md), or [Preact](https://vadivam.praveenjuge.com/docs/preact.md).

### Set shared defaults

```tsx
import { Activity, Search, VadivamProvider } from "vadivam-react";

<VadivamProvider size={20} color="navy" strokeWidth={1.5}>
  <Activity />
  <Search color="tomato" />
</VadivamProvider>;
```

An icon's own props override provider values. Angular uses `provideVadivamConfig({ size: 20, color: "navy", strokeWidth: 1.5 })` in its providers instead. Astro has no provider API. See [Usage](https://vadivam.praveenjuge.com/docs/usage.md#shared-defaults).

### Render an icon from a runtime name

1. Validate the string against `iconNames`:

   ```ts
   import { iconNames, type IconName } from "vadivam-react/dynamic";

   export function isIconName(value: string): value is IconName {
     return iconNames.includes(value as IconName);
   }
   ```

2. Render it with `DynamicIcon` from the package's `/dynamic` entry point:

   ```tsx
   import { DynamicIcon } from "vadivam-react/dynamic";

   <DynamicIcon name="activity" size={20} fallback={null} />;
   ```

React, React Native, Vue, Solid, and Preact export a named `DynamicIcon`; Svelte and Astro export it as the default; Angular uses the `vadivamDynamicIcon` directive. See [Dynamic icons](https://vadivam.praveenjuge.com/docs/dynamic-icons.md).

### Use raw SVGs without a framework

```js
import activitySvgUrl from "vadivam/icons/activity.svg"; // asset URL
import activitySvg from "vadivam/strings/activity"; // SVG markup
import { Activity, createElement } from "vadivam"; // icon node

const svg = createElement(Activity, { width: 20, height: 20, "aria-label": "Activity" });
```

`createIcons({ icons: { Activity, Search } })` replaces `<i data-vadivam="activity">` placeholders. `vadivam/sprite.svg` and `vadivam/font/vadivam.css` provide a sprite and a WOFF2 icon font. `vadivam/manifest` exports `iconNames`, `icons`, and `iconsByName`. See [Core SVG and JavaScript](https://vadivam.praveenjuge.com/docs/core.md).

### Label or hide an icon

- Decorative icon next to text: `<Activity aria-hidden="true" />`.
- Meaningful icon: `<Activity role="img" aria-label="Service is active" />` or `<Activity title="Service is active" />`.
- Icon-only button: name the button, `<button aria-label="Search"><Search aria-hidden="true" /></button>`.
- React Native: `<Activity accessibilityLabel="Service is active" accessible />`.

See [Usage](https://vadivam.praveenjuge.com/docs/usage.md#accessibility).

## Gotchas

- Use a dynamic icon only when the name is data (a CMS field, configuration). Runtime data still needs validation against `iconNames`, even though `name` is typed as `IconName`.
- `absoluteStrokeWidth` exists in every component and directive package, but not in the core `createElement` helper.
- `createIcons` adds `aria-hidden="true"` to unlabeled placeholders; `createElement` does not, so label or hide its result yourself.
- In the root `vadivam` entry point, `icons` is the component-name-to-icon-node registry and `manifest` is the metadata array; `vadivam/manifest` exports its metadata array as `icons`.
- Importing the complete `icons` registry or the sprite makes every icon reachable. Prefer per-icon imports when download size matters.
- The core package has no lazy `DynamicIcon`. Use a small icon-node map with `createIcons`, or a framework package.
- `/dynamicIconImports` module shapes are framework-specific; do not share loaded modules across framework packages.
- Do not concatenate untrusted attributes or content into `vadivam/strings/*` markup.

## Where to look

- [Icon catalog](https://vadivam.praveenjuge.com/): browse every icon; each is also served at `https://vadivam.praveenjuge.com/icons/<kebab-name>.svg`.
- [AI agents](https://vadivam.praveenjuge.com/docs/ai-agents.md): how agents should consume Vadivam.
- [Contributing](https://vadivam.praveenjuge.com/docs/contributing.md): add icons or change packages.
- [Changelog](https://vadivam.praveenjuge.com/changelog.md): release notes, newest first.
- [llms.txt](https://vadivam.praveenjuge.com/llms.txt): every page with a one-line summary; [llms-full.txt](https://vadivam.praveenjuge.com/llms-full.txt) has every page in one file.
