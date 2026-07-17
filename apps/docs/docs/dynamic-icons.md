---
title: Dynamic icons
description: Load Vadivam icons safely when icon names come from runtime data.
---

Use a dynamic icon only when the icon name is data rather than source code—for example, a CMS field or navigation configuration. For known icons, prefer a static named import because it is simpler and directly tree-shakeable.

Dynamic names are kebab-case values such as `activity`, `arrow-right`, and `trash-2`. Framework packages type them as `IconName` and expose an `iconNames` list and lazy `dynamicIconImports` map.

## Component API

React, React Native, Vue, Solid, and Preact export a named `DynamicIcon` from their `/dynamic` entry point:

```tsx
import { DynamicIcon, type IconName } from "vadivam-react/dynamic";

export function DataIcon({ name }: { name: IconName }) {
  return (
    <DynamicIcon
      name={name}
      size={20}
      fallback={<span aria-hidden="true">…</span>}
      aria-label={name}
    />
  );
}
```

The component loads the matching per-icon module. A fallback is optional. Keep untrusted strings outside the component until they have been checked against `iconNames`:

```ts
import { iconNames, type IconName } from "vadivam-react/dynamic";

export function isIconName(value: string): value is IconName {
  return iconNames.includes(value as IconName);
}
```

Svelte and Astro expose their dynamic component as the default export:

```svelte
<script lang="ts">
  import DynamicIcon from "vadivam-svelte/dynamic";
</script>

<DynamicIcon name="activity" size={20} title="Activity" />
```

```astro
---
import DynamicIcon from "vadivam-astro/dynamic";
---

<DynamicIcon name="activity" size={20} title="Activity" />
```

Angular uses a standalone directive:

```ts
import { Component } from "@angular/core";
import { DynamicIcon } from "vadivam-angular/dynamic";

@Component({
  imports: [DynamicIcon],
  template: '<svg vadivamDynamicIcon="activity" title="Activity"></svg>',
})
export class StatusIcon {}
```

See each [framework guide](/docs#choose-a-package) for complete syntax.

## Import map API

Each framework package exports its generated lazy-import map from `/dynamicIconImports`:

```ts
import dynamicIconImports, {
  iconNames,
} from "vadivam-react/dynamicIconImports";

const module = await dynamicIconImports.activity();
const Activity = module.default;
```

This low-level API is useful for a custom cache or loading boundary. Its module shape is framework-specific, so do not share loaded modules across framework packages.

## Bundle and rendering notes

- Dynamic imports create separate asynchronous modules; the exact chunks depend on the bundler.
- The `name` API is restricted to generated icon names in TypeScript, but runtime data still needs validation.
- Fallback types differ by framework: React-family packages accept renderable nodes, Svelte accepts a snippet, and Angular's directive accepts icon-node data.
- The core `vadivam` package has no lazy `DynamicIcon` component. Use a small icon-node map with `createIcons`, or choose a framework package.
