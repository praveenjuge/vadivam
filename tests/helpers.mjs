// Fixtures and checks that several test files share. Facts about icons,
// packages, and styles come from the canonical modules in scripts/; this file
// only holds what no product module owns.
import { expect } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

export const repoRoot = path.resolve(import.meta.dir, "..");

// The MCP server's public tool names, which clients call by name.
export const mcpToolNames = ["get_icon", "get_usage", "list_categories", "search_icons", "suggest_icons"];

// A custom icon node an attacker could pass to Icon or createIcon: elements
// that run code or load URLs, event handlers, external paint, raw HTML props,
// and attribute names that try to break out of the tag. Every renderer must
// keep only the two paths and their safe geometry and paint.
export const unsafeIconNode = [
  ["script", { href: "https://example.com/x.js", key: "script" }],
  ["animate", { attributeName: "href", values: "javascript:alert(1)", key: "animate" }],
  ["image", { href: "javascript:alert(1)", key: "image" }],
  ["path", {
    d: "M4 12h16",
    stroke: "navy",
    onclick: "alert(1)",
    fill: "url(https://example.com/p.svg#x)",
    innerHTML: "<script>alert(1)</script>",
    dangerouslySetInnerHTML: { __html: "<script>alert(1)</script>" },
    key: "safe",
  }],
  ["path", {
    d: "M2 4h2",
    'bad" onload': "alert(1)",
    ".innerHTML": "<script>alert(1)</script>",
    "prop:innerHTML": "<script>alert(1)</script>",
    key: "malformed",
  }],
];

/** Checks rendered markup of `unsafeIconNode`: the safe geometry survives, nothing else does. */
export function expectSafeIconMarkup(markup) {
  expect(markup).toContain('d="M4 12h16"');
  expect(markup).toContain('stroke="navy"');
  expect(markup).toContain('d="M2 4h2"');
  for (const unsafe of ["<script", "<animate", "<image", "onclick", "onload", "href=", "alert(1)", "example.com", "innerhtml", "bad&quot;"]) {
    expect(markup.toLowerCase()).not.toContain(unsafe);
  }
}

/** The attributes of every `<tag …>` in markup, in document order, whatever order they were written in. */
export function tagAttributes(markup, tag) {
  return [...markup.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, "g"))].map(([, source]) =>
    Object.fromEntries([...source.matchAll(/([^\s=/]+)(?:="([^"]*)")?/g)].map(([, name, value = ""]) => [name, value])),
  );
}

/** The attributes of the first `<svg>` in markup. */
export function svgAttributes(markup) {
  const [attributes] = tagAttributes(markup, "svg");
  if (!attributes) throw new Error(`No <svg> in: ${markup}`);
  return attributes;
}

/**
 * Bundles a small app the way an app bundler would. Returns its code, every
 * module the imports reached (`modules`, what a bundler that does not
 * tree-shake, such as Metro, would ship), and a `bytesFrom(pattern)` that sums
 * the output bytes of the modules whose path matches after tree-shaking. The
 * entry lives under tests/ so bare package names resolve to the workspace
 * packages.
 */
export async function bundle(source, { external = [], minify = false } = {}) {
  const directory = mkdtempSync(path.join(import.meta.dir, ".bundle-"));
  try {
    const entry = path.join(directory, "entry.jsx");
    writeFileSync(entry, source);
    const result = await Bun.build({ entrypoints: [entry], external, minify, target: "browser", metafile: true });
    if (!result.success) throw new AggregateError(result.logs, "bundle failed");
    const [output] = Object.values(result.metafile.outputs);
    const inputs = Object.entries(output.inputs);
    const bytesFrom = (pattern) =>
      inputs.filter(([file]) => pattern.test(file)).reduce((sum, [, { bytesInOutput }]) => sum + bytesInOutput, 0);
    return { code: await result.outputs[0].text(), modules: Object.keys(result.metafile.inputs), bytesFrom };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/** Retries an assertion until it passes, for results that arrive asynchronously. */
export async function eventually(assertion, { timeout = 2000, interval = 5 } = {}) {
  const deadline = Date.now() + timeout;
  for (;;) {
    try {
      return await assertion();
    } catch (error) {
      if (Date.now() > deadline) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}
