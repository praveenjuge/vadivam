# vadivam-react-native

Pixel-perfect, open-source React Native icons for refined interfaces.

![All Vadivam icons](https://raw.githubusercontent.com/praveenjuge/vadivam/main/apps/web/public/preview.png?v=0.0.19)

```sh
bun add vadivam-react-native react-native-svg
```

For data-driven icon names, import `DynamicIcon` from
`vadivam-react-native/dynamic`.

```tsx
import { Activity } from "vadivam-react-native";

export function Example() {
  return <Activity size={20} color="navy" strokeWidth={2} />;
}
```

Icons accept every `react-native-svg` `SvgProps` property, plus `size` and
`absoluteStrokeWidth`. Native refs and SVG children are forwarded.

Apply shared defaults with the provider:

```tsx
import { Activity, VadivamProvider } from "vadivam-react-native";

<VadivamProvider size={20} color="navy" strokeWidth={1.5}>
  <Activity />
</VadivamProvider>;
```

Every icon has normal, suffixed, and prefixed aliases:

```tsx
import { Activity, ActivityIcon, VadivamActivity } from "vadivam-react-native";
```

Use direct imports when the icon is known for the smallest dependency graph:

```tsx
import Activity, { __iconNode } from "vadivam-react-native/icons/activity";
```

Custom icon nodes use the same native renderer:

```tsx
import { Icon, createVadivamIcon } from "vadivam-react-native";

const node = [["path", { d: "M4 12h16", key: "line" }]] as const;
const Custom = createVadivamIcon("custom", node);

<Icon iconNode={node} />;
<Custom />;
```

The `dynamicIconImports` and `iconNames` exports support typed custom lookup
flows without eagerly importing the complete icon registry.
