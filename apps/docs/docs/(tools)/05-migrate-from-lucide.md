---
title: Migrate from Lucide
description: Switch from Lucide to Vadivam with one codemod. Every icon keeps its Lucide name, and each framework package mirrors the Lucide API.
related:
  - /docs/installation
  - /docs/usage
  - /docs/dynamic-icons
search:
  keywords: [lucide, lucide-react, migrate, migration, codemod, replace, drop-in]
---

Vadivam covers every current Lucide icon name, redrawn on the same 24px grid with the same 2px stroke. Each framework package mirrors the matching Lucide package, so most projects switch by renaming the package and the `Lucide` prefix. Layouts stay the same because the canvas, stroke, and props are unchanged.

## Run the codemod

From your project root, preview the changes, then apply them:

```sh
npx vadivam migrate-lucide
npx vadivam migrate-lucide --write
```

Pass paths to limit the run, such as `npx vadivam migrate-lucide src --write`. It skips `node_modules`, build output, and framework caches. It then:

- rewrites Lucide imports, dynamic `import()` calls, `require()` calls, and test mocks to the matching Vadivam package
- maps `/dynamic`, `/dynamicIconImports`, and per-icon paths such as `lucide-react/dist/esm/icons/bell` to their Vadivam equivalents
- renames `Lucide` names imported or required from Lucide, and their uses outside strings (a re-export keeps its public name, as in `VadivamBell as LucideBell`): `LucideBell` becomes `VadivamBell`, `LucideProps` becomes `VadivamProps`, and `createLucideIcon` becomes `createVadivamIcon`
- imports deprecated Lucide aliases from their current name under the old local name, such as `CircleAlert as AlertCircle` and `House as Home`, so the rest of the file stays as written
- replaces Lucide dependencies in each `package.json` with the matching Vadivam package
- changes `data-lucide` attributes to `data-vadivam`, and `.lucide` CSS classes to `.vadivam` in stylesheets and component `<style>` blocks

Without `--write` the codemod only lists what would change. Afterwards, reinstall dependencies so your lockfile drops Lucide.

The codemod also lists what it left for you to check: imports Vadivam does not export, test mock factories whose keys name Lucide exports, and packages that need a hand migration. Icon names held in strings, such as a `DynamicIcon` name from data, are not renamed; check old aliases there against [Dynamic icons](/docs/dynamic-icons).

## Package map

| Lucide                                 | Vadivam                |
| -------------------------------------- | ---------------------- |
| `lucide-react`                         | `vadivam-react`        |
| `lucide-react-native`                  | `vadivam-react-native` |
| `lucide-vue-next`, `@lucide/vue`       | `vadivam-vue`          |
| `lucide-svelte`, `@lucide/svelte`      | `vadivam-svelte`       |
| `lucide-solid`                         | `vadivam-solid`        |
| `lucide-preact`                        | `vadivam-preact`       |
| `@lucide/astro`                        | `vadivam-astro`        |
| `lucide`                               | `vadivam`              |
| `lucide-angular`, `@lucide/angular`    | `vadivam-angular` (by hand) |
| `lucide-static`                        | `vadivam` assets (by hand)  |

## What stays the same

- Icon names: `arrow-right` and `ArrowRight` exist in both, and `ArrowRightIcon` works too.
- Props: `size`, `color`, `strokeWidth`, `absoluteStrokeWidth`, `className`, and any native SVG attribute.
- Dynamic icons: `DynamicIcon`, `iconNames`, and `dynamicIconImports` from the `/dynamic` and `/dynamicIconImports` entry points. See [Dynamic icons](/docs/dynamic-icons).
- Browser JavaScript: `createIcons({ icons })` from `vadivam` replaces `<i data-vadivam="menu">` elements like Lucide's does with `data-lucide`.

Rendered icons carry `vadivam vadivam-<name>` classes instead of `lucide lucide-<name>`, so the codemod updates CSS selectors that target them.

## Angular

`vadivam-angular` uses one standalone directive per icon instead of a `lucide-icon` component. Replace each icon by hand:

```ts
import { Component } from "@angular/core";
import { ArrowRight } from "vadivam-angular";

@Component({
  selector: "app-next",
  imports: [ArrowRight],
  template: `<svg vadivamArrowRight size="20"></svg>`,
})
export class NextComponent {}
```

Use `provideVadivamConfig()` for app-wide defaults. See [Angular](/docs/angular).

## Static assets

For `lucide-static` files, use the matching `vadivam` assets: `vadivam/icons/<name>.svg` for files, `vadivam/strings/<name>` for SVG strings, `vadivam/sprite.svg` for a sprite, and `vadivam/font/vadivam.css` for the icon font. See [Core SVG](/docs/core).

## Compare the drawings

Each icon page, such as `/icons/arrow-right`, can switch its large preview between the Vadivam drawing, the Lucide one, an overlay of the two, and a split view with a draggable divider. In the compare views, the real-size row below it shows both drawings at 16 to 48px, and the view options switch the preview between light and dark backgrounds. Vadivam follows a stricter [design guide](/docs/design-guide): whole-pixel lines, smoothed corners, and consistent keylines.
