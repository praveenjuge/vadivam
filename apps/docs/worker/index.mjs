// The docs site's Worker entry. It answers the remote MCP endpoint at /mcp
// and hands every other request to Blume's generated Worker unchanged.
// scripts/docs-worker.mjs bundles this file next to Blume's build output.
import { createVadivamHttpHandler } from "vadivam-mcp";
import blume from "./blume-worker.mjs";

const mcpPath = "/mcp";

// The endpoint is public, read-only, and uncredentialed, so browser-based
// MCP clients may call it from any origin.
const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-expose-headers": "mcp-session-id, mcp-protocol-version",
};

let mcp;

async function handleMcp(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
        "access-control-allow-headers":
          request.headers.get("access-control-request-headers") ??
          "content-type, accept, mcp-protocol-version, mcp-session-id, last-event-id",
        "access-control-max-age": "86400",
      },
    });
  }
  mcp ??= createVadivamHttpHandler();
  const response = await mcp.fetch(request);
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(corsHeaders)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env, context) {
    const { pathname } = new URL(request.url);
    if (pathname === mcpPath || pathname === `${mcpPath}/`) return handleMcp(request);
    return blume.fetch(request, env, context);
  },
};
