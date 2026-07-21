---
title: Astro
description: Use free, open-source Vadivam static SVG icon components in Astro 7 with per-icon imports, runtime names, and no client JavaScript.
seo:
  title: Astro Icons – 24px Outline Icon Components
---

`vadivam-astro` supports Astro 7 and renders native SVG during Astro rendering. It does not require a client framework.

```sh
npm install vadivam-astro
```

## Basic usage

```astro
---
import { Activity } from "vadivam-astro";
---

<Activity size={20} color="navy" strokeWidth={1.5} title="Activity" />
```

Components accept Astro SVG HTML attributes plus `size`, `color`, `strokeWidth`, `stroke-width`, `absoluteStrokeWidth`, and `title`.

## Per-icon imports

```astro
---
import Activity from "vadivam-astro/activity";
import Search from "vadivam-astro/icons/search";
---

<Activity size={20} aria-hidden="true" />
<Search size={20} title="Search" />
```

Static imports are the best default and render without client-side JavaScript.

## Runtime names

Astro's dynamic entry is a default component export:

```astro
---
import DynamicIcon from "vadivam-astro/dynamic";

const name = "activity";
---

<DynamicIcon name={name} size={20} title="Activity" />
```

The generated lazy import map and `iconNames` are available from `vadivam-astro/dynamicIconImports`. Dynamic icon resolution occurs as part of Astro rendering; it is not a hydrated client component by itself.

The root package also exports a generic `Icon`, `createVadivamIcon`, icon definitions, and related types for advanced custom-icon use. There is no `VadivamProvider` in the Astro package, so pass defaults through your own wrapper component if needed.

See [Dynamic icons](/docs/dynamic-icons) and [Usage, styling, and accessibility](/docs/usage).
