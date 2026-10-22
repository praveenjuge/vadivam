#!/usr/bin/env node
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { version } from "./data.js";
import { createVadivamServer } from "./server.js";

const args = process.argv.slice(2);
if (args.includes("--version") || args.includes("-v")) {
  console.log(version);
  process.exit(0);
}
if (args.includes("--help") || args.includes("-h")) {
  console.log(`vadivam-mcp ${version}

An MCP server over stdio for searching Vadivam icons and getting SVG or framework code.
Add it to an MCP client, for example:

  claude mcp add vadivam -- npx -y vadivam-mcp

Docs: https://vadivam.praveenjuge.com/docs/mcp`);
  process.exit(0);
}

const handle = serveStdio(() => createVadivamServer(), {
  onerror: (error) => console.error(`vadivam-mcp: ${error.message}`),
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    void handle.close().finally(() => process.exit(0));
  });
}
