# vadivam-mcp

An MCP server for searching 24px outline and solid icons and getting SVG or framework code. AI agents use it to find the right Vadivam icon by name, synonym, or category instead of guessing names.

[Browse icons](https://vadivam.praveenjuge.com) · [MCP docs](https://vadivam.praveenjuge.com/docs/mcp) · [Source](https://github.com/praveenjuge/vadivam/tree/main/packages/vadivam-mcp) · [GitHub](https://github.com/praveenjuge/vadivam)

[![npm version](https://img.shields.io/npm/v/vadivam-mcp?style=flat-square&color=111)](https://www.npmjs.com/package/vadivam-mcp)
[![downloads](https://img.shields.io/npm/dw/vadivam-mcp?style=flat-square&color=666)](https://www.npmjs.com/package/vadivam-mcp)
[![license](https://img.shields.io/npm/l/vadivam-mcp?style=flat-square&color=111)](https://github.com/praveenjuge/vadivam/blob/main/LICENSE)

Use the hosted server, with nothing to install:

```sh
claude mcp add --transport http vadivam https://vadivam.praveenjuge.com/mcp
```

Or run it locally over stdio. The icon data ships inside the package, so it works offline and matches this release:

```sh
claude mcp add vadivam -- npx -y vadivam-mcp
```

```json
{
  "mcpServers": {
    "vadivam": { "command": "npx", "args": ["-y", "vadivam-mcp"] }
  }
}
```

| Tool              | What it does                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| `search_icons`    | Ranked search over names, tags, and categories, with an optional category filter                |
| `suggest_icons`   | Candidate icons for each thing a UI description mentions                                        |
| `get_icon`        | One icon as SVG, JSX, a framework snippet, data URI, CSS mask, Tailwind class, CDN URL, sprite, font, or shadcn |
| `list_categories` | Every category with its id, title, description, and icon count                                  |
| `get_usage`       | Install command, import example, and docs link for a framework package                          |

To host it yourself, `createVadivamServer()` returns a fresh `McpServer` and `createVadivamHttpHandler()` wraps it in a stateless Streamable HTTP handler for Cloudflare Workers, Deno, or Bun:

```js
import { createVadivamHttpHandler } from "vadivam-mcp";

export default createVadivamHttpHandler();
```

Package family: [SVG and JavaScript](https://www.npmjs.com/package/vadivam) · [React](https://www.npmjs.com/package/vadivam-react) · [React Native](https://www.npmjs.com/package/vadivam-react-native) · [Vue](https://www.npmjs.com/package/vadivam-vue) · [Svelte](https://www.npmjs.com/package/vadivam-svelte) · [Solid](https://www.npmjs.com/package/vadivam-solid) · [Angular](https://www.npmjs.com/package/vadivam-angular) · [Astro](https://www.npmjs.com/package/vadivam-astro) · [Preact](https://www.npmjs.com/package/vadivam-preact) · [Qwik](https://www.npmjs.com/package/vadivam-qwik) · [Lit](https://www.npmjs.com/package/vadivam-lit) · [Flutter](https://pub.dev/packages/vadivam) · [Jetpack Compose](https://central.sonatype.com/artifact/com.praveenjuge/vadivam-compose)

[Issues](https://github.com/praveenjuge/vadivam/issues)
