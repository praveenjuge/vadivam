import { createMcpHandler } from "@modelcontextprotocol/server";
import { createVadivamServer } from "./server.js";

export { createVadivamServer, instructions, renderIcon, usageFor } from "./server.js";
export { closestIconNames, findIcon, searchIcons } from "./search.js";
export { categories, icons, version } from "./data.js";

/**
 * A stateless Streamable HTTP handler with a web-standard `fetch(request)`,
 * for Cloudflare Workers, Deno, Bun, or any fetch-based runtime.
 */
export function createVadivamHttpHandler(options) {
  return createMcpHandler(() => createVadivamServer(), options);
}
