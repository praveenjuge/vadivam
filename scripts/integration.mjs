// Builds real framework applications against materialized local packages and
// verifies the browser packages from their production output.
// Usage: bun scripts/integration.mjs [app...], or --matrix for the CI shards.
import { cpSync, existsSync, readFileSync, rmSync } from "node:fs";
import { performance } from "node:perf_hooks";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { forEachConcurrently, run } from "./lib/process.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const integrationDir = path.join(root, "tests", "integration");
const commandTimeoutMs = 5 * 60 * 1000;
const browserLaunchTimeoutMs = 60 * 1000;
// The static app renders the activity icon from the icon font.
const activityCodepoint = JSON.parse(readFileSync(path.join(root, "scripts/font-codepoints.json"), "utf8")).activity;
// Each app runs in one CI shard on pull requests; `cache` lists build caches
// worth keeping besides node_modules.
const allApps = [
  { name: "static", shard: "react-web", packages: ["vadivam"], output: "dist", verifier: "static-assets" },
  { name: "nextjs", shard: "react-web", packages: ["vadivam-react"], cache: [".next/cache"] },
  { name: "tanstack-start", shard: "react-web", packages: ["vadivam-react"] },
  { name: "vite-react", shard: "react-web", packages: ["vadivam-react"] },
  {
    name: "expo",
    shard: "native-and-ui",
    packages: ["vadivam-react-native"],
    buildIncludesTypecheck: true,
  },
  { name: "vue", shard: "native-and-ui", packages: ["vadivam-vue"], output: "dist", verifiesFunctionEvents: true },
  { name: "svelte", shard: "native-and-ui", packages: ["vadivam-svelte"], output: "build", verifiesFunctionEvents: true },
  { name: "solid", shard: "native-and-ui", packages: ["vadivam-solid"], output: "dist", verifiesFunctionEvents: true },
  {
    name: "angular",
    shard: "compiled-web",
    packages: ["vadivam-angular"],
    output: "dist/vadivam-integration-angular/browser",
    buildIncludesTypecheck: true,
  },
  { name: "astro", shard: "compiled-web", packages: ["vadivam-astro"], output: "dist" },
  { name: "preact", shard: "compiled-web", packages: ["vadivam-preact"], output: "dist", verifiesFunctionEvents: true },
  // Qwik's client-only render() doesn't attach onClick$ listeners even on
  // plain elements, so event props are covered by tests/frameworks instead.
  { name: "qwik", shard: "compiled-web", packages: ["vadivam-qwik"], output: "dist" },
  // Lit templates can't spread attributes onto the icon, so each one renders
  // inside a wrapper element that carries its id and click handler.
  { name: "lit", shard: "compiled-web", packages: ["vadivam-lit"], output: "dist", verifiesFunctionEvents: true, wrapped: true },
];

// The GitHub Actions matrix: one entry per shard with its apps and cache paths.
if (process.argv[2] === "--matrix") {
  const include = Object.entries(Object.groupBy(allApps, (app) => app.shard)).map(([shard, shardApps]) => ({
    shard,
    apps: shardApps.map((app) => app.name).join(" "),
    cache_paths: shardApps
      .flatMap((app) => ["node_modules", ...(app.cache ?? [])].map((cache) => `tests/integration/${app.name}/${cache}`))
      .join("\n"),
  }));
  console.log(JSON.stringify({ include }));
  process.exit(0);
}

const requestedApps = new Set(process.argv.slice(2));
const apps = requestedApps.size
  ? allApps.filter(({ name }) => requestedApps.has(name))
  : allApps;
if (requestedApps.size && apps.length !== requestedApps.size) {
  throw new Error(`Unknown integration app: ${[...requestedApps].filter((name) => !apps.some((app) => app.name === name)).join(", ")}`);
}

function step(command, args, cwd) {
  console.log(`\n$ ${command} ${args.join(" ")}  (cwd: ${path.relative(root, cwd)})`);
  return run(command, args, { cwd, timeoutMs: commandTimeoutMs });
}

async function launchBrowser() {
  const { chromium } = await import("playwright");
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await chromium.launch({
        headless: true,
        timeout: browserLaunchTimeoutMs,
      });
    } catch (error) {
      lastError = error;
      console.warn(`Chromium launch attempt ${attempt} failed: ${error.message}`);
    }
  }
  throw lastError;
}

function materializePackage(cwd, packageName) {
  const src = path.join(root, "packages", packageName);
  const dest = path.join(cwd, "node_modules", packageName);
  rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, {
    recursive: true,
    dereference: true,
    filter: (source) => !source.includes(`${path.sep}node_modules${path.sep}`),
  });
}

// Serves a production build, falling back to index.html like a static host.
function serveDirectory(directory, port) {
  return Bun.serve({
    port,
    async fetch(request) {
      const pathname = new URL(request.url).pathname;
      const resolved = path.resolve(directory, pathname === "/" ? "index.html" : pathname.slice(1));
      if (!resolved.startsWith(`${directory}${path.sep}`) && resolved !== directory) {
        return new Response("Not found", { status: 404 });
      }
      const file = Bun.file(resolved);
      return new Response((await file.exists()) ? file : Bun.file(path.join(directory, "index.html")));
    },
  });
}

async function verifyBrowser(browser, app, cwd, index) {
  const port = 4310 + index;
  const url = `http://127.0.0.1:${port}`;
  const server = serveDirectory(path.join(cwd, app.output), port);
  let page;
  try {
    page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("requestfailed", (request) =>
      errors.push(`${request.url()}: ${request.failure()?.errorText ?? "request failed"}`),
    );
    await page.goto(url, { waitUntil: "networkidle" });
    if (app.verifier === "static-assets") {
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => {
        const stringIcon = document.querySelector("#string");
        const spriteIcon = document.querySelector("#sprite-use");
        return (
          document.querySelector("#element")?.shadowRoot?.querySelector("svg path") &&
          document.fonts.check('24px "Vadivam Icons"') &&
          stringIcon?.querySelector("path, circle, line, polyline, polygon, rect, ellipse") &&
          spriteIcon?.getBBox().width > 0 &&
          spriteIcon?.getBBox().height > 0
        );
      });
      const result = await page.evaluate(() => {
        const stringIcon = document.querySelector("#string");
        const spriteIcon = document.querySelector("#sprite-use");
        const fontIcon = document.querySelector("#font");
        const element = document.querySelector("#element");
        const elementSvg = element.shadowRoot.querySelector("svg");
        const fontStyle = getComputedStyle(fontIcon);
        const pseudo = getComputedStyle(fontIcon, "::before").content.replace(/^['\"]|['\"]$/g, "");
        return {
          fontFamily: fontStyle.fontFamily,
          fontGlyph: pseudo.codePointAt(0),
          fontHeight: fontIcon.getBoundingClientRect().height,
          fontLoaded: document.fonts.check('24px "Vadivam Icons"'),
          fontWidth: fontIcon.getBoundingClientRect().width,
          spriteHeight: spriteIcon.getBBox().height,
          spriteWidth: spriteIcon.getBBox().width,
          stringGeometry: stringIcon.querySelectorAll(
            "path, circle, line, polyline, polygon, rect, ellipse",
          ).length,
          elementWidth: element.getBoundingClientRect().width,
          elementStroke: elementSvg.getAttribute("stroke"),
          elementStrokeWidth: elementSvg.getAttribute("stroke-width"),
          elementVectorEffect: elementSvg.querySelector("path").getAttribute("vector-effect"),
          elementLabel: elementSvg.getAttribute("aria-label"),
        };
      });
      if (errors.length) throw new Error(`${app.name}: ${errors.join(" | ")}`);
      if (
        !result.fontLoaded ||
        !result.fontFamily.includes("Vadivam Icons") ||
        result.fontGlyph !== activityCodepoint ||
        result.fontWidth <= 0 ||
        result.fontHeight <= 0 ||
        result.spriteWidth <= 0 ||
        result.spriteHeight <= 0 ||
        result.stringGeometry <= 0 ||
        result.elementWidth !== 48 ||
        result.elementStroke !== "navy" ||
        result.elementStrokeWidth !== "2" ||
        result.elementVectorEffect !== "non-scaling-stroke" ||
        result.elementLabel !== "Activity chart"
      ) {
        throw new Error(`${app.name}: invalid static assets ${JSON.stringify(result)}`);
      }
      console.log(`Browser smoke passed for ${app.name}.`);
      return;
    }
    await page.waitForFunction(() =>
      ["static", "direct", "dynamic", "factory", "security"].every(
        (id) => document.querySelector(`#${id}`)?.children.length,
      ),
    );
    const result = await page.evaluate((wrapped) => {
      const read = (id) => {
        const svg = document.querySelector(wrapped ? `#${id} > svg` : `#${id}`);
        return {
          tag: svg?.tagName,
          width: svg?.getAttribute("width"),
          height: svg?.getAttribute("height"),
          stroke: svg?.getAttribute("stroke"),
          strokeWidth: svg?.getAttribute("stroke-width"),
          className: svg?.getAttribute("class"),
          ariaHidden: svg?.getAttribute("aria-hidden"),
          role: svg?.getAttribute("role"),
          custom: svg?.getAttribute("data-custom"),
          paths: svg?.querySelectorAll("path, circle, line, polyline, polygon, rect, ellipse").length ?? 0,
        };
      };
      return {
        staticIcon: read("static"),
        direct: read("direct"),
        dynamic: read("dynamic"),
        factory: read("factory"),
        security: read("security"),
        securityUnsafe: document.querySelectorAll("#security script, #security animate, #security image, #security [onclick], #security [onbegin], #security [onerror], #security [href], #security [src]").length,
        securityRawContent: document.querySelector("#security")?.innerHTML.includes("alert(1)") ?? false,
        title: document.querySelector("#static title")?.textContent,
      };
    }, Boolean(app.wrapped));
    if (app.verifiesFunctionEvents) {
      await page.click("#static");
      result.functionEventCount = await page.evaluate(() => window.__vadivamFunctionEventCount ?? 0);
    }
    if (errors.length) throw new Error(`${app.name}: ${errors.join(" | ")}`);
    const icon = result.staticIcon;
    const classNames = icon.className?.split(/\s+/) ?? [];
    if (icon.tag?.toLowerCase() !== "svg" || icon.width !== "48" || icon.height !== "48" || icon.stroke !== "navy" || icon.strokeWidth !== "1" || icon.paths === 0 || result.title !== "Activity chart" || icon.role !== "img" || icon.ariaHidden !== null || (!app.wrapped && icon.custom !== "yes") || !classNames.includes("vadivam") || !classNames.includes("vadivam-activity") || !classNames.includes("context-icon") || !classNames.includes("consumer-icon") || classNames.length !== new Set(classNames).size) {
      throw new Error(`${app.name}: invalid static icon ${JSON.stringify(result)}`);
    }
    if (result.direct.paths === 0 || result.dynamic.paths === 0 || result.factory.paths === 0 || result.direct.ariaHidden !== "true" || result.dynamic.ariaHidden !== "true" || result.factory.ariaHidden !== "true" || !result.factory.className?.split(/\s+/).includes("vadivam-factory")) {
      throw new Error(`${app.name}: direct, dynamic, or factory icon did not render`);
    }
    if (result.security.paths !== 1 || result.security.stroke !== "currentColor" || result.securityUnsafe !== 0 || result.securityRawContent) {
      throw new Error(`${app.name}: unsafe runtime icon content survived ${JSON.stringify(result)}`);
    }
    if (app.verifiesFunctionEvents && result.functionEventCount !== 1) {
      throw new Error(`${app.name}: function event handler was not preserved ${JSON.stringify(result)}`);
    }
    console.log(`Browser smoke passed for ${app.name}.`);
  } finally {
    await page?.close();
    server.stop(true);
  }
}

let browserPromise;

async function validateIntegrationApp(app, index) {
  const startedAt = performance.now();
  const cwd = path.join(integrationDir, app.name);
  if (!existsSync(cwd)) throw new Error(`integration app missing: ${cwd}`);
  await step("bun", ["install", "--frozen-lockfile"], cwd);
  for (const packageName of app.packages) materializePackage(cwd, packageName);
  const manifest = JSON.parse(readFileSync(path.join(cwd, "package.json"), "utf8"));
  if (manifest.scripts?.typecheck && !app.buildIncludesTypecheck) {
    await step("bun", ["run", "typecheck"], cwd);
  }
  await step("bun", ["run", "build"], cwd);
  if (app.output) {
    browserPromise ??= launchBrowser();
    await verifyBrowser(await browserPromise, app, cwd, index);
  }
  console.log(
    `[integration] ${app.name} passed in ${((performance.now() - startedAt) / 1000).toFixed(2)}s`,
  );
}

try {
  await forEachConcurrently(apps, 3, validateIntegrationApp);
  console.log(`\nIntegration builds passed for: ${apps.map(({ name }) => name).join(", ")}`);
} finally {
  if (browserPromise) await (await browserPromise).close();
}
