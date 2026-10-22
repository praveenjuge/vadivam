import { afterAll, describe, expect, test } from "bun:test";
import {
  Client,
  InMemoryTransport,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import {
  createVadivamHttpHandler,
  createVadivamServer,
  version,
} from "../../packages/vadivam-mcp/dist/index.js";

const toolNames = ["get_icon", "get_usage", "list_categories", "search_icons", "suggest_icons"];
const clients = [];

async function inMemoryClient() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await createVadivamServer().connect(serverTransport);
  const client = new Client({ name: "vadivam-test", version: "1.0.0" });
  await client.connect(clientTransport);
  clients.push(client);
  return client;
}

// The remote endpoint's handler, called in-process through the client's fetch hook.
async function httpClient(mode) {
  const handler = createVadivamHttpHandler();
  const client = new Client(
    { name: "vadivam-test", version: "1.0.0" },
    mode ? { versionNegotiation: { mode } } : undefined,
  );
  await client.connect(
    new StreamableHTTPClientTransport(new URL("https://vadivam.test/mcp"), {
      fetch: (input, init) => handler.fetch(new Request(input, init)),
    }),
  );
  clients.push(client);
  return client;
}

afterAll(async () => {
  for (const client of clients) await client.close();
});

function text(result) {
  return result.content.map((block) => block.text).join("\n");
}

async function exerciseTools(client) {
  const { tools } = await client.listTools();
  expect(tools.map((tool) => tool.name).sort()).toEqual(toolNames);
  for (const tool of tools) {
    expect(tool.annotations?.readOnlyHint).toBe(true);
    expect(tool.outputSchema?.type).toBe("object");
  }
  const search = tools.find((tool) => tool.name === "search_icons");
  expect(search.inputSchema.required).toEqual(["query"]);

  const found = await client.callTool({
    name: "search_icons",
    arguments: { query: "arrow right", limit: 3 },
  });
  expect(found.isError).toBeFalsy();
  expect(found.structuredContent.results).toHaveLength(3);
  expect(found.structuredContent.results[0].name).toBe("arrow-right");
  expect(text(found)).toContain("arrow-right (ArrowRight)");

  const inCategory = await client.callTool({
    name: "search_icons",
    arguments: { query: "", category: "weather", limit: 5 },
  });
  expect(inCategory.structuredContent.category).toBe("weather");

  const badCategory = await client.callTool({
    name: "search_icons",
    arguments: { query: "sun", category: "nope" },
  });
  expect(badCategory.isError).toBe(true);

  const suggested = await client.callTool({
    name: "suggest_icons",
    arguments: { description: "settings sidebar with search, notifications and logout", perConcept: 2 },
  });
  expect(suggested.isError).toBeFalsy();
  expect(suggested.structuredContent.concepts.map(({ concept }) => concept)).toEqual([
    "settings",
    "sidebar",
    "search",
    "notifications",
    "logout",
  ]);
  expect(suggested.structuredContent.concepts.every(({ results }) => results.length <= 2)).toBe(true);
  expect(text(suggested)).toContain("notifications: bell (Bell)");

  const svg = await client.callTool({
    name: "get_icon",
    arguments: { name: "activity", size: 32, color: "red" },
  });
  expect(svg.structuredContent.format).toBe("svg");
  expect(svg.structuredContent.code).toContain('width="32"');
  expect(svg.structuredContent.code).toContain('stroke="red"');

  const react = await client.callTool({
    name: "get_icon",
    arguments: { name: "ArrowRight", format: "react" },
  });
  expect(react.structuredContent.install).toBe("npm install vadivam-react");
  expect(react.structuredContent.code).toContain('import { ArrowRight } from "vadivam-react";');
  expect(text(react)).toStartWith("npm install vadivam-react");

  const unknown = await client.callTool({ name: "get_icon", arguments: { name: "acitvity" } });
  expect(unknown.isError).toBe(true);
  expect(text(unknown)).toContain("activity");

  const badFormat = await client.callTool({
    name: "get_icon",
    arguments: { name: "activity", format: "png" },
  });
  expect(badFormat.isError).toBe(true);

  const listed = await client.callTool({ name: "list_categories", arguments: {} });
  const weather = listed.structuredContent.categories.find((category) => category.id === "weather");
  expect(weather.iconCount).toBeGreaterThan(0);
  expect(weather.title).toBe("Weather");

  const usage = await client.callTool({ name: "get_usage", arguments: { framework: "vue" } });
  expect(usage.structuredContent).toMatchObject({
    packageName: "vadivam-vue",
    install: "npm install vadivam-vue",
    docs: "https://vadivam.praveenjuge.com/docs/vue",
  });
}

describe("vadivam-mcp server", () => {
  test("serves every tool over an in-memory connection", async () => {
    const client = await inMemoryClient();
    expect(client.getServerVersion()).toMatchObject({ name: "vadivam", version });
    expect(client.getInstructions()).toContain("search_icons");
    await exerciseTools(client);
  });

  test("serves 2025-era clients over stateless Streamable HTTP", async () => {
    const client = await httpClient();
    expect(client.getNegotiatedProtocolVersion()).toStartWith("2025-");
    await exerciseTools(client);
  });

  test("serves current-era clients over Streamable HTTP", async () => {
    const client = await httpClient("auto");
    expect(client.getNegotiatedProtocolVersion()).not.toStartWith("2025-");
    await exerciseTools(client);
  });
});
