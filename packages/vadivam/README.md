# vadivam

Pixel-perfect, open-source, gorgeous SVG icons for refined interfaces.

![All Vadivam icons](https://raw.githubusercontent.com/praveenjuge/vadivam/main/apps/web/public/preview.png?v=0.0.18)

```sh
bun add vadivam
```

```js
import { Activity, createElement } from "vadivam";
import activitySvgUrl from "vadivam/icons/activity.svg";

const svg = createElement(Activity, { width: 20, height: 20 });
```

Icon nodes are also available through tree-shakable subpaths:

```js
import Activity from "vadivam/icons/activity";
```

Replace elements in HTML using `createIcons`:

```html
<i data-vadivam="activity" aria-label="Activity"></i>
```

```js
import { createIcons, icons } from "vadivam";

createIcons({ icons });
```

`createIcons` accepts `attrs`, `nameAttr`, `root`, and `inTemplates`. Pass a
shadow root through `root`, or set `inTemplates: true` to process template
contents. The complete metadata collection remains available as `manifest`,
or from `vadivam/manifest`.

The canonical source lives in the repository root `icons/` folder. Package
files are generated during build.
