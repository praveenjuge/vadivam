# vadivam-react

Pixel-perfect, open-source, gorgeous React icons for refined interfaces.

![All Vadivam icons](https://raw.githubusercontent.com/praveenjuge/vadivam/main/apps/web/public/preview.png?v=0.0.19)

```sh
bun add vadivam-react
```

```tsx
import { Activity } from "vadivam-react";

export function Example() {
  return <Activity size={20} color="currentColor" strokeWidth={2} />;
}
```

Icons accept SVG properties, `size`, `color`, `strokeWidth`,
`absoluteStrokeWidth`, `title`, refs, and SVG children. Use `fill` for filled
icons, or nest icons and SVG elements to combine them.

Apply shared defaults with the provider or target the generated `vadivam` and
`vadivam-{name}` classes in CSS:

```tsx
import { Activity, VadivamProvider } from "vadivam-react";

<VadivamProvider size={20} color="navy" strokeWidth={1.5}>
  <Activity />
</VadivamProvider>;
```

Every icon has normal, suffixed, and prefixed aliases:

```tsx
import { Activity, ActivityIcon, VadivamActivity } from "vadivam-react";
```

Per-icon, generic-node, and dynamic APIs are generated during build:

```tsx
import Activity, { __iconNode } from "vadivam-react/activity";
import { Icon } from "vadivam-react";
import { DynamicIcon, iconNames } from "vadivam-react/dynamic";

<Icon iconNode={__iconNode} />;
<DynamicIcon name="activity" />;
```

Prefer static icon imports when the icon name is known. `DynamicIcon` is
intended for names stored in external data and creates a separate lazy module
for every icon.
