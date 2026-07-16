# vadivam-astro

Pixel-perfect, open-source Vadivam icons for Astro.

![All Vadivam icons](https://raw.githubusercontent.com/praveenjuge/vadivam/main/apps/web/public/preview.png?v=0.0.19)

```sh
bun add vadivam-astro
```

```astro
---
import { Activity } from "vadivam-astro";
---
<Activity size={20} color="navy" />
```

Icons accept native SVG attributes plus `size`, `color`, `strokeWidth`,
`absoluteStrokeWidth`, and `title`. Static named and per-icon imports are
tree-shakeable. For data-driven names, use `DynamicIcon` from
`vadivam-astro/dynamic` and `dynamicIconImports` from
`vadivam-astro/dynamicIconImports`.
