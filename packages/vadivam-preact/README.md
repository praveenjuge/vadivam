# vadivam-preact

Pixel-perfect, open-source Vadivam icons for Preact.

![All Vadivam icons](https://raw.githubusercontent.com/praveenjuge/vadivam/main/apps/web/public/preview.png?v=0.0.21)

```sh
bun add vadivam-preact
```

```tsx
import { Activity, VadivamProvider } from "vadivam-preact";

<VadivamProvider size={20} color="navy"><Activity /></VadivamProvider>
```

Icons accept native SVG attributes plus `size`, `color`, `strokeWidth`,
`absoluteStrokeWidth`, and `title`. Static named and per-icon imports are
tree-shakeable. For data-driven names, use `DynamicIcon` from
`vadivam-preact/dynamic` and `dynamicIconImports` from
`vadivam-preact/dynamicIconImports`.
