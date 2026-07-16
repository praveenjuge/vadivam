# vadivam-angular

Pixel-perfect, open-source Vadivam icons for Angular.

![All Vadivam icons](https://raw.githubusercontent.com/praveenjuge/vadivam/main/apps/web/public/preview.png?v=0.0.20)

```sh
bun add vadivam-angular
```

```ts
import { Component } from "@angular/core";
import { Activity } from "vadivam-angular";

@Component({ imports: [Activity], template: '<svg vadivamActivity size="20" color="navy"></svg>' })
export class Example {}
```

Icons accept native SVG attributes plus `size`, `color`, `strokeWidth`,
`absoluteStrokeWidth`, and `title`. Static named and per-icon imports are
tree-shakeable. For data-driven names, use `DynamicIcon` from
`vadivam-angular/dynamic` and `dynamicIconImports` from
`vadivam-angular/dynamicIconImports`.
