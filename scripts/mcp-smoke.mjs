// Smoke-test a deployed or local MCP endpoint with the official client:
//   bun scripts/mcp-smoke.mjs http://127.0.0.1:8787/mcp
//   bun scripts/mcp-smoke.mjs https://vadivam.praveenjuge.com/mcp
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const url = new URL(process.argv[2] ?? "https://vadivam.praveenjuge.com/mcp");

for (const mode of ["legacy", "auto"]) {
  const client = new Client({ name: "vadivam-smoke", version: "1.0.0" }, { versionNegotiation: { mode } });
  await client.connect(new StreamableHTTPClientTransport(url));
  const { tools } = await client.listTools();
  const search = await client.callTool({ name: "search_icons", arguments: { query: "arrow right", limit: 3 } });
  const icon = await client.callTool({ name: "get_icon", arguments: { name: "activity", format: "react", size: 20 } });
  const top = search.structuredContent?.results?.[0]?.name;
  if (top !== "arrow-right" || !icon.structuredContent?.code?.includes("vadivam-react")) {
    throw new Error(`Unexpected ${mode} results: ${JSON.stringify({ top, icon: icon.structuredContent })}`);
  }
  console.log(
    `${mode}: protocol ${client.getNegotiatedProtocolVersion()}, server ${client.getServerVersion()?.name}@${client.getServerVersion()?.version}, tools ${tools.map((tool) => tool.name).join(", ")}, search top ${top}`,
  );
  await client.close();
}
