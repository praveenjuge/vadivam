// End-to-end: serve a freshly generated registry locally, install icons with
// the pinned shadcn CLI into a scratch project, then typecheck and render
// what it wrote. External network requests from the CLI are blocked; the one
// shadcn asset the CLI always loads (the base color) is stubbed locally.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { icons } from "vadivam/manifest";
import { buildShadcnRegistry } from "../scripts/generators/shadcn.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "node_modules/shadcn/dist/index.js");
const tsc = path.join(root, "node_modules/typescript/bin/tsc");
const node = Bun.which("node");
const picked = icons.filter(({ name }) => ["activity", "arrow-right"].includes(name));

let project;
let server;
let registryUrl;

const fetchGuard = `const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (url.hostname !== "127.0.0.1") {
    console.error("[blocked network request] " + url.href);
    return Promise.reject(new TypeError("Blocked network request: " + url.href));
  }
  return realFetch(input, init);
};
`;

// Async on purpose: the registry server runs in this process, so a
// synchronous spawn would block it from answering the CLI.
async function shadcn(...args) {
  const child = Bun.spawn(
    [node, "--import", path.join(project, "fetch-guard.mjs"), cli, ...args, "--cwd", project],
    {
      env: { ...process.env, CI: "1", NO_COLOR: "1", REGISTRY_URL: `${registryUrl}/shadcn/r` },
      stdout: "pipe",
      stderr: "pipe",
      timeout: 90_000,
    },
  );
  const [stdout, stderr, status] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  const output = `${stdout}\n${stderr}`;
  expect(output).not.toContain("[blocked network request]");
  if (status !== 0) throw new Error(`shadcn ${args.join(" ")} failed (${status}):\n${output}`);
  return output;
}

beforeAll(async () => {
  project = await mkdtemp(path.join(tmpdir(), "vadivam-shadcn-"));
  const publicDir = path.join(project, "public");
  server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const file = Bun.file(path.join(publicDir, new URL(request.url).pathname));
      return (await file.exists())
        ? new Response(file, { headers: { "Content-Type": "application/json" } })
        : new Response("Not found", { status: 404 });
    },
  });
  registryUrl = `http://127.0.0.1:${server.port}`;
  await buildShadcnRegistry(picked, path.join(publicDir, "r"), { baseUrl: registryUrl });
  await mkdir(path.join(publicDir, "shadcn/r/colors"), { recursive: true });
  await writeFile(
    path.join(publicDir, "shadcn/r/colors/neutral.json"),
    JSON.stringify({
      inlineColors: { light: {}, dark: {} },
      cssVars: { light: {}, dark: {} },
      inlineColorsTemplate: "",
      cssVarsTemplate: "",
    }),
  );

  await symlink(path.join(root, "node_modules"), path.join(project, "node_modules"), "dir");
  await mkdir(path.join(project, "src/app"), { recursive: true });
  await writeFile(path.join(project, "fetch-guard.mjs"), fetchGuard);
  await writeFile(path.join(project, "src/app/globals.css"), "");
  await writeFile(
    path.join(project, "package.json"),
    JSON.stringify({ name: "shadcn-consumer", private: true, type: "module", dependencies: { react: "*", "react-dom": "*" } }),
  );
  await writeFile(
    path.join(project, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        jsx: "react-jsx",
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        verbatimModuleSyntax: true,
        types: [],
        paths: { "@/*": ["./src/*"] },
      },
      include: ["src"],
    }),
  );
  await writeFile(
    path.join(project, "components.json"),
    JSON.stringify({
      $schema: "https://ui.shadcn.com/schema.json",
      style: "new-york",
      rsc: true,
      tsx: true,
      tailwind: { config: "", css: "src/app/globals.css", baseColor: "neutral", cssVariables: true },
      aliases: { components: "@/components", utils: "@/lib/utils", ui: "@/components/ui", lib: "@/lib", hooks: "@/hooks" },
      registries: { "@vadivam": `${registryUrl}/r/{name}.json` },
    }),
  );
});

afterAll(async () => {
  server?.stop(true);
  if (project) await rm(project, { recursive: true, force: true });
});

const iconsDir = () => path.join(project, "src/components/icons");

describe.skipIf(!node)("shadcn CLI install", () => {
  test("adds an icon by URL together with the shared base component", async () => {
    const output = await shadcn("add", `${registryUrl}/r/activity.json`, "--yes", "--overwrite");
    expect(output).toContain("src/components/icons/vadivam-icon.tsx");
    expect(output).toContain("src/components/icons/activity.tsx");
    const installed = await readFile(path.join(iconsDir(), "activity.tsx"), "utf8");
    const [{ content }] = (await Bun.file(path.join(project, "public/r/activity.json")).json()).files;
    expect(installed).toBe(content);
  }, 120_000);

  test("adds an icon through the @vadivam namespace and finds it with search", async () => {
    await shadcn("add", "@vadivam/arrow-right", "--yes", "--overwrite");
    expect(await Bun.file(path.join(iconsDir(), "arrow-right.tsx")).exists()).toBe(true);
    const output = await shadcn("search", "@vadivam", "-q", "arrow-right");
    expect(output).toContain("@vadivam/arrow-right");
  }, 120_000);

  test("installed components typecheck under strict TypeScript", async () => {
    await writeFile(
      path.join(project, "src/app/page.tsx"),
      `import { useRef } from "react";
import { Activity } from "@/components/icons/activity";
import ArrowRight, { ArrowRightIcon } from "@/components/icons/arrow-right";

export function Page() {
  const ref = useRef<SVGSVGElement>(null);
  return (
    <nav>
      <Activity ref={ref} size={32} color="red" strokeWidth={1.5} absoluteStrokeWidth title="Pulse" className="icon" onClick={() => {}} />
      <ArrowRight aria-label="Next" />
      <ArrowRightIcon size="1em" />
    </nav>
  );
}

// @ts-expect-error size must be a number or string
export const invalid = <Activity size={{}} />;
`,
    );
    const result = spawnSync(process.execPath, [tsc, "-p", project], { encoding: "utf8" });
    expect(`${result.stdout}${result.stderr}`).toBe("");
    expect(result.status).toBe(0);
  }, 120_000);

  test("installed components render the icon with the documented props", async () => {
    const { Activity } = await import(path.join(iconsDir(), "activity.tsx"));
    const svg = picked.find(({ name }) => name === "activity").svg;
    const [, d] = svg.match(/ d="([^"]+)"/);

    expect(renderToStaticMarkup(createElement(Activity))).toBe(
      `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="vadivam vadivam-activity" aria-hidden="true"><path d="${d}"></path></svg>`,
    );

    const labelled = renderToStaticMarkup(
      createElement(Activity, { size: 48, color: "red", strokeWidth: 2, absoluteStrokeWidth: true, title: "Pulse", className: "x" }),
    );
    expect(labelled).toContain('width="48"');
    expect(labelled).toContain('stroke="red"');
    expect(labelled).toContain('stroke-width="1"');
    expect(labelled).toContain('class="vadivam vadivam-activity x"');
    expect(labelled).toContain('role="img"');
    expect(labelled).toContain("<title>Pulse</title>");
    expect(labelled).not.toContain("aria-hidden");

    const named = renderToStaticMarkup(createElement(Activity, { "aria-label": "Activity" }));
    expect(named).toContain('aria-label="Activity"');
    expect(named).not.toContain("aria-hidden");
  });
});
