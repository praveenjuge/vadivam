# vadivam-react

React components for the Vadivam icon set.

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
