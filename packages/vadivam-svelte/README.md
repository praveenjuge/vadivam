# vadivam-svelte

Pixel-perfect, open-source Vadivam icons for Svelte.

![All Vadivam icons](https://raw.githubusercontent.com/praveenjuge/vadivam/main/apps/web/public/preview.png?v=0.0.19)

```sh
bun add vadivam-svelte
```

```svelte
<script>import { Activity, VadivamProvider } from "vadivam-svelte";</script>
<VadivamProvider size={20} color="navy"><Activity /></VadivamProvider>
```

Icons accept native SVG attributes plus `size`, `color`, `strokeWidth`,
`absoluteStrokeWidth`, and `title`. Static named and per-icon imports are
tree-shakeable. For data-driven names, use `DynamicIcon` from
`vadivam-svelte/dynamic` and `dynamicIconImports` from
`vadivam-svelte/dynamicIconImports`.
