# vadivam-react

Pixel-perfect, open-source, gorgeous React icons for refined interfaces.

![All Vadivam icons](https://raw.githubusercontent.com/praveenjuge/vadivam/main/apps/web/public/preview.png)

```sh
bun add vadivam-react
```

```tsx
import { Activity } from "vadivam-react";

export function Example() {
  return <Activity size={20} color="currentColor" />;
}
```

Per-icon and dynamic imports are generated during build:

```tsx
import Activity from "vadivam-react/activity";
import { DynamicIcon } from "vadivam-react/dynamic";
```
