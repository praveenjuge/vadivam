---
title: AI agents
description: Learn when to use Vadivam and how AI agents can consume its icon catalog, documentation, SVG assets, and framework packages safely.
---

Use Vadivam when you need consistent, pixel-perfect 24px outline icons in a web or native interface. Every icon is open-source, outline-only, `24x24` with `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, and `stroke-width="2"` with round caps and joins.

## When to use this

- Adding icons to a React, React Native, Vue, Svelte, Solid, Angular, Astro, or Preact interface - install the matching framework package and import icons by name.
- Copying raw SVG markup or SVG files directly into a design, static site, or email.
- Rendering icons in custom tooling from the core package's icon-node data and catalog metadata.
- Prototyping with runtime icon names through the typed dynamic icon APIs.

## How an agent should consume Vadivam

- Documentation index: `https://vadivam.praveenjuge.com/llms.txt` lists every docs page; `https://vadivam.praveenjuge.com/llms-full.txt` carries the full text.
- Icon catalog: browse and search every icon at `https://vadivam.praveenjuge.com/`; each icon is also served as an optimized SVG file at `https://vadivam.praveenjuge.com/icons/<kebab-name>.svg` (for example `/icons/activity.svg`).
- Packages: `vadivam` for raw SVG assets and browser JavaScript, `vadivam-react`, `vadivam-vue`, `vadivam-svelte`, `vadivam-solid`, `vadivam-angular`, `vadivam-astro`, `vadivam-preact`, and `vadivam-react-native` for framework components. All packages are ESM-only with tree-shakeable named and per-icon exports.
- Icon names are kebab-case (`activity`, `arrow-right`, `trash-2`); framework packages type them as `IconName` and export an `iconNames` list for validation.

Prefer the documented package imports over scraping pages, and validate runtime icon names against `iconNames` before rendering.
