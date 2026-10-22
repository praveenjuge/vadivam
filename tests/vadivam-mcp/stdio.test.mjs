import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const packageDirectory = fileURLToPath(new URL("../../packages/vadivam-mcp/", import.meta.url));
const manifest = JSON.parse(readFileSync(`${packageDirectory}package.json`, "utf8"));
const cli = `${packageDirectory}${manifest.bin["vadivam-mcp"]}`;
// Run the bin the way npx does: with Node when it is installed.
const runtime = spawnSync("node", ["--version"]).status === 0 ? "node" : process.execPath;

describe("vadivam-mcp CLI", () => {
  test("is an executable Node script", () => {
    expect(readFileSync(cli, "utf8")).toStartWith("#!/usr/bin/env node\n");
    expect(statSync(cli).mode & 0o111).not.toBe(0);
    const result = spawnSync(runtime, [cli, "--version"], { encoding: "utf8" });
    expect(result.stdout.trim()).toBe(manifest.version);
  });

  for (const mode of [undefined, "auto"]) {
    test(`answers over stdio (${mode ?? "2025"} negotiation)`, async () => {
      const client = new Client(
        { name: "vadivam-stdio-test", version: "1.0.0" },
        mode ? { versionNegotiation: { mode } } : undefined,
      );
      await client.connect(new StdioClientTransport({ command: runtime, args: [cli], stderr: "pipe" }));
      try {
        expect(client.getServerVersion()).toMatchObject({ name: "vadivam", version: manifest.version });
        const { tools } = await client.listTools();
        expect(tools.map((tool) => tool.name).sort()).toEqual([
          "get_icon",
          "get_usage",
          "list_categories",
          "search_icons",
          "suggest_icons",
        ]);
        const found = await client.callTool({ name: "search_icons", arguments: { query: "trash", limit: 1 } });
        expect(found.structuredContent.results[0].name).toBe("trash");
        const icon = await client.callTool({ name: "get_icon", arguments: { name: "trash", format: "vue" } });
        expect(icon.structuredContent.code).toContain('from "vadivam-vue"');
      } finally {
        await client.close();
      }
    }, 30_000);
  }
});
