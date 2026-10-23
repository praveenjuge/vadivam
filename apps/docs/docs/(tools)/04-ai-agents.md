---
title: AI agents
description: Learn when to use Vadivam and how AI agents can consume its icon catalog, documentation, SVG assets, and framework packages safely.
related:
  - /docs/mcp
  - /docs/core
  - /docs/installation
search:
  keywords: [llms.txt, skill.md, mcp, agent]
---

Use Vadivam when you need consistent, pixel-perfect 24px outline icons in a web or native interface. Every icon is open-source, outline-only, `24x24` with `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, and `stroke-width="2"` with round caps and joins.

## When to use this

- Adding icons to a React, React Native, Vue, Svelte, Solid, Angular, Astro, or Preact interface - install the matching framework package and import icons by name.
- Copying raw SVG markup or SVG files directly into a design, static site, or email.
- Rendering icons in custom tooling from the core package's icon-node data and catalog metadata.
- Prototyping with runtime icon names through the typed dynamic icon APIs.

## How an agent should consume Vadivam

- MCP server: connect to `https://vadivam.praveenjuge.com/mcp` or run `npx -y vadivam-mcp` to search icons by name, tag, or category and get SVG or framework code with the `search_icons`, `suggest_icons`, `get_icon`, `list_categories`, and `get_usage` tools. See [MCP server](/docs/mcp).
- Documentation index: `https://vadivam.praveenjuge.com/llms.txt` lists every docs page; `https://vadivam.praveenjuge.com/llms-full.txt` carries the full text.
- Agent skill: `https://vadivam.praveenjuge.com/skill.md` teaches an agent to find, install, import, size, label, and dynamically load Vadivam icons, with links to each docs page. It is also listed in `https://vadivam.praveenjuge.com/.well-known/agent-skills/index.json` and ships in the `vadivam` package at `skills/vadivam-icons/SKILL.md`.
- Icon catalog: browse and search every icon at `https://vadivam.praveenjuge.com/`; each icon is also served as an optimized SVG file at `https://vadivam.praveenjuge.com/icons/<kebab-name>.svg` (for example `/icons/activity.svg`).
- Icon metadata: `vadivam/manifest` gives every icon's `tags` (search synonyms) and `categories`, plus the `categories` list, for finding icons offline. [Categories and naming](/docs/categories) lists every category and how names map to each package.
- Packages: `vadivam` for raw SVG assets and browser JavaScript, `vadivam-react`, `vadivam-vue`, `vadivam-svelte`, `vadivam-solid`, `vadivam-angular`, `vadivam-astro`, `vadivam-preact`, and `vadivam-react-native` for framework components. All packages are ESM-only with tree-shakeable named and per-icon exports.
- shadcn/ui registry: `https://vadivam.praveenjuge.com/r/<kebab-name>.json` is a registry item per icon, indexed at `https://vadivam.praveenjuge.com/r/registry.json`. Install with `npx shadcn@latest add` (see [shadcn/ui](/docs/shadcn)).
- Icon names are kebab-case (`activity`, `arrow-right`, `trash`); framework packages type them as `IconName` and export an `iconNames` list for validation.

Prefer the documented package imports over scraping pages, search with the MCP server or the manifest instead of guessing icon names, and validate runtime icon names against `iconNames` before rendering.
