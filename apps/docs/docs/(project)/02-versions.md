---
title: Versions and compatibility
description: How Vadivam packages are versioned and released together, what every release is tested against, and how to verify a published package.
related:
  - /docs/installation
  - /docs/how-icons-are-built
  - /docs/contributing
search:
  keywords: [version, upgrade, release, changelog, compatibility, provenance, peer dependencies, ssr]
---

## One version for every package

Every Vadivam package shares one version number: `vadivam`, the ten npm framework packages, `vadivam-mcp`, the Flutter package on pub.dev, and the Compose library on Maven Central are released together from the same icon source. When you use more than one package, keep them on the same version, and upgrade them together.

Vadivam is before 1.0, so any release can change an API. Read the [changelog](/changelog) before upgrading. It lists the icons added or redrawn and the package changes in each release.

Icon names follow the pinned Lucide release. A release that moves to a newer Lucide version can add icons and adopt Lucide's renamed icons; see [Categories and naming](/docs/categories).

## Tested in every release

A release is published only from a commit that passed the full test suite:

- Production builds of real apps that install the freshly built packages: Next.js, Vite with React, TanStack Start, Vue, Svelte, Solid, Angular, Astro, Preact, Qwik, Lit, and a plain HTML page with `<vadivam-icon>`. The plain HTML, Vue, Svelte, Solid, Angular, Astro, Preact, Qwik, and Lit apps are also served and checked in Chromium.
- React Native through an Expo app, exported for Android and iOS.
- React server rendering in a true server environment, with no DOM, alongside client rendering tests, and Lit server rendering with Lit SSR.
- The Flutter package through `flutter analyze`, widget tests that draw every icon, and a pub.dev dry run.
- The Compose library through an Android release build and unit tests that build every icon's `ImageVector`.
- The [shadcn/ui registry](/docs/shadcn), installed with the real `shadcn` CLI into a fresh project.
- The [MCP server](/docs/mcp) tools, over both stdio and HTTP.
- Every icon, against the rules in [How icons are built](/docs/how-icons-are-built).

The framework versions each package supports are listed under [peer requirements](/docs/installation#peer-requirements).

## Verify a package

Packages are published from GitHub Actions through npm Trusted Publishing, with no long-lived publish tokens. npm shows a provenance statement on each package page that links the published files to the release commit. In a project installed with `npm install` or `npm ci` (npm 9.5 or newer), check the installed packages' signatures and provenance:

```sh
npm audit signatures
```

The Flutter package is published to pub.dev from the same workflow with GitHub's OIDC identity, and the Compose library is signed and uploaded to Maven Central.

Each [GitHub release](https://github.com/praveenjuge/vadivam/releases) also carries the matching [Figma plugin](/docs/figma-plugin) build and the [Android vector drawables](/docs/compose#android-views), and the MCP server's entry in the [MCP Registry](https://registry.modelcontextprotocol.io) is published from the same release.
