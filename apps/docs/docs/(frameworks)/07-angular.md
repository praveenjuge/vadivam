---
title: Angular
description: Use free, open-source Vadivam standalone SVG icon directives, configuration providers, and dynamic names in Angular.
seo:
  title: Angular Icons – 24px Outline Icon Directives
related:
  - /docs/usage
  - /docs/dynamic-icons
  - /docs/installation
search:
  keywords: [directive, standalone]
---

`vadivam-angular` supports Angular 22. Unlike the component packages, each icon is a standalone directive applied to an `<svg>` element.

```sh
npm install vadivam-angular
```

## Static icon directive

```ts
import { Component } from "@angular/core";
import { Activity } from "vadivam-angular";

@Component({
  selector: "app-status",
  imports: [Activity],
  template: `
    <svg
      vadivamActivity
      size="20"
      color="navy"
      strokeWidth="1.5"
      title="Activity"
    ></svg>
  `,
})
export class StatusComponent {}
```

Static directive selectors follow `svg[vadivamComponentName]`, such as `svg[vadivamActivity]` and `svg[vadivamArrowRight]`. Inputs include `size`, `color`, `strokeWidth`, `absoluteStrokeWidth`, and `title`. The directive adds the SVG defaults and icon paths.

## Application defaults

Provide shared values at bootstrap or another injector boundary:

```ts
import { bootstrapApplication } from "@angular/platform-browser";
import { provideVadivamConfig } from "vadivam-angular";
import { AppComponent } from "./app.component";

bootstrapApplication(AppComponent, {
  providers: [
    provideVadivamConfig({
      size: 20,
      color: "navy",
      strokeWidth: 1.5,
      class: "app-icon",
    }),
  ],
});
```

An icon's inputs override configured defaults.

## Generic icon directive

The generic standalone `Icon` directive accepts an exported icon definition:

```ts
import { Component } from "@angular/core";
import { Icon, icons } from "vadivam-angular";

@Component({
  imports: [Icon],
  template: '<svg [vadivamIcon]="activity" title="Activity"></svg>',
})
export class GenericIconComponent {
  readonly activity = icons.Activity;
}
```

Use a static icon directive when possible; it gives Angular a direct dependency on only that icon.

## Solid icons

Every icon has a [solid](/docs/design-guide#solid) twin in the `vadivam-angular/solid` entry point. Solid directives have the same class names, and their selectors carry `Solid`, so both styles can be used in one template:

```ts
import { Component, input } from "@angular/core";
import { House } from "vadivam-angular";
import { House as HouseSolid } from "vadivam-angular/solid";

@Component({
  selector: "app-home-tab",
  imports: [House, HouseSolid],
  template: `
    @if (active()) {
      <svg vadivamSolidHouse size="20" title="Home"></svg>
    } @else {
      <svg vadivamHouse size="20" title="Home"></svg>
    }
  `,
})
export class HomeTab {
  readonly active = input(false);
}
```

Solid icons fill their shapes with `color` and ignore `strokeWidth` and `absoluteStrokeWidth`. `provideVadivamConfig` sets defaults for both styles. The generic and dynamic directives are `svg[vadivamSolidIcon]` and `svg[vadivamSolidDynamicIcon]`.

## Runtime names

```ts
import { Component } from "@angular/core";
import { DynamicIcon } from "vadivam-angular/dynamic";

@Component({
  imports: [DynamicIcon],
  template: '<svg [vadivamDynamicIcon]="name" title="Activity"></svg>',
})
export class DynamicStatusComponent {
  readonly name = "activity";
}
```

The dynamic directive lazy-loads icon-node data. Its optional `fallback` input expects icon-node data rather than an Angular template. `DynamicIcon`, `iconNames`, and `dynamicIconImports` are exported from both the package bundle and the `/dynamic` export.

Angular adds `aria-hidden="true"` when an icon has no title, ARIA attribute, or role. A title adds an SVG `<title>` and `role="img"`. See [Dynamic icons](/docs/dynamic-icons) and [Accessibility](/docs/accessibility).
