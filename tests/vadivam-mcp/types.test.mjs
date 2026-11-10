import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { styleIds } from "../../scripts/icon-styles.mjs";
import { frameworks } from "../../scripts/packages.mjs";
import { copyFormats } from "../../scripts/snippets.mjs";

const declarations = readFileSync(new URL("../../packages/vadivam-mcp/src/index.d.ts", import.meta.url), "utf8");

/** The string literals of one exported union type. */
function union(name) {
  const start = declarations.indexOf(`export type ${name} =`);
  if (start < 0) throw new Error(`index.d.ts has no ${name} type`);
  const body = declarations.slice(start, declarations.indexOf(";", start));
  return [...body.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

// index.d.ts is hand-written, so its unions must follow the registries the
// server copies from scripts/ at build time and reads at runtime.
describe("vadivam-mcp type declarations", () => {
  test("IconFormat lists every copy format", () => {
    expect(union("IconFormat")).toEqual(copyFormats.map((format) => format.id));
  });

  test("UsageFramework lists core and every framework", () => {
    expect(union("UsageFramework")).toEqual(["core", ...frameworks.map((framework) => framework.id)]);
  });

  test("the MCP docs page lists every format", () => {
    const page = readFileSync(new URL("../../apps/docs/docs/(tools)/03-mcp.mdx", import.meta.url), "utf8");
    const listed = page.match(/`format` accepts ([^.]*)\./)?.[1] ?? "";
    expect([...listed.matchAll(/`([^`]+)`/g)].map((match) => match[1])).toEqual(copyFormats.map((format) => format.id));
  });

  test("IconStyle lists every style", () => {
    expect(union("IconStyle")).toEqual([...styleIds]);
  });
});
