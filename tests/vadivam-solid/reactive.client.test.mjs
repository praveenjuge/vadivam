// The published Solid package ships its components as JSX for the consumer's
// compiler, so this compiles IconBase for the DOM, as a browser app would, and
// checks that root attributes follow props after the first render.
import { afterAll, describe, expect, test } from "bun:test";
import { transformAsync } from "@babel/core";
import solidPreset from "babel-preset-solid";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { repoRoot } from "../helpers.mjs";

const source = path.join(repoRoot, "packages/vadivam-solid/dist/source");
const compiled = mkdtempSync(path.join(import.meta.dir, ".solid-"));
afterAll(() => rmSync(compiled, { recursive: true, force: true }));

async function compile(name) {
  const code = readFileSync(path.join(source, name), "utf8");
  const { code: output } = await transformAsync(code, { filename: name, presets: [[solidPreset, { generate: "dom" }]] });
  // Plain modules stay in the package; compiled JSX modules sit next to each other here.
  const resolved = output
    .replace(/from "\.\/([\w-]+)\.js"/g, (_match, file) => `from ${JSON.stringify(path.join(source, `${file}.js`))}`)
    .replace(/from "\.\/([\w-]+)\.jsx"/g, 'from "./$1.js"');
  writeFileSync(path.join(compiled, name.replace(/\.jsx$/, ".js")), resolved);
}
await compile("context.jsx");
await compile("IconBase.jsx");
const { IconBase } = await import(path.join(compiled, "IconBase.js"));

describe("vadivam-solid IconBase in the browser", () => {
  test("a label that starts undefined applies and clears reactively", () => {
    const [label, setLabel] = createSignal(undefined);
    const container = document.createElement("div");
    const dispose = render(
      () => IconBase({ name: "bell", iconNode: [], get "aria-label"() { return label(); } }),
      container,
    );
    const svg = container.querySelector("svg");
    expect(svg.getAttribute("aria-label")).toBeNull();
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    setLabel("Notifications");
    expect(svg.getAttribute("aria-label")).toBe("Notifications");
    expect(svg.getAttribute("aria-hidden")).toBeNull();
    setLabel(undefined);
    expect(svg.getAttribute("aria-label")).toBeNull();
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    dispose();
  });
});
