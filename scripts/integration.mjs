// Builds real framework applications against materialized local packages and
// verifies the seven browser packages from their production output.
import { spawn } from "node:child_process";
import { once } from "node:events";
import { cpSync, existsSync, readFileSync, rmSync } from "node:fs";
import { performance } from "node:perf_hooks";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const integrationDir = path.join(root, "tests", "integration");
const commandTimeoutMs = 5 * 60 * 1000;
const browserLaunchTimeoutMs = 60 * 1000;
const allApps = [
  { name: "static", packages: ["vadivam"], output: "dist", verifier: "static-assets" },
  { name: "nextjs", packages: ["vadivam-react"] },
  { name: "tanstack-start", packages: ["vadivam-react"] },
  { name: "vite-react", packages: ["vadivam-react"] },
  {
    name: "expo",
    packages: ["vadivam-react-native"],
    buildIncludesTypecheck: true,
  },
  { name: "vue", packages: ["vadivam-vue"], output: "dist", verifiesFunctionEvents: true },
  { name: "svelte", packages: ["vadivam-svelte"], output: "build", verifiesFunctionEvents: true },
  { name: "solid", packages: ["vadivam-solid"], output: "dist", verifiesFunctionEvents: true },
  {
    name: "angular",
    packages: ["vadivam-angular"],
    output: "dist/vadivam-integration-angular/browser",
    buildIncludesTypecheck: true,
  },
  { name: "astro", packages: ["vadivam-astro"], output: "dist" },
  { name: "preact", packages: ["vadivam-preact"], output: "dist", verifiesFunctionEvents: true },
];
const requestedApps = new Set(process.argv.slice(2));
const apps = requestedApps.size
  ? allApps.filter(({ name }) => requestedApps.has(name))
  : allApps;
if (requestedApps.size && apps.length !== requestedApps.size) {
  throw new Error(`Unknown integration app: ${[...requestedApps].filter((name) => !apps.some((app) => app.name === name)).join(", ")}`);
}

function run(command, args, cwd) {
  console.log(`\n$ ${command} ${args.join(" ")}  (cwd: ${path.relative(root, cwd)})`);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    let timedOut = false;
    let forceKillTimeout;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      forceKillTimeout = setTimeout(() => child.kill("SIGKILL"), 5000);
    }, commandTimeoutMs);
    child.on("error", (error) => {
      clearTimeout(timeout);
      clearTimeout(forceKillTimeout);
      reject(
        new Error(`${command} ${args.join(" ")} failed in ${cwd}: ${error.message}`),
      );
    });
    child.on("exit", (code, signal) => {
      clearTimeout(timeout);
      clearTimeout(forceKillTimeout);
      if (code === 0) {
        resolve();
        return;
      }
      const reason = timedOut ? "timed out" : `exited with ${signal ?? code}`;
      reject(new Error(`${command} ${args.join(" ")} ${reason} in ${cwd}`));
    });
  });
}

async function launchBrowser() {
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

async function waitForServer(url) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function verifyBrowser(browser, app, cwd, index) {
  const port = 4310 + index;
  const url = `http://127.0.0.1:${port}`;
  const server = spawn(
    "bun",
    [path.join(root, "scripts/serve-dist.mjs"), path.join(cwd, app.output), String(port)],
    { cwd: root, stdio: "inherit" },
  );
  let page;
  try {
    await waitForServer(url);
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
        };
      });
      if (errors.length) throw new Error(`${app.name}: ${errors.join(" | ")}`);
      if (
        !result.fontLoaded ||
        !result.fontFamily.includes("Vadivam Icons") ||
        result.fontGlyph !== 0xe004 ||
        result.fontWidth <= 0 ||
        result.fontHeight <= 0 ||
        result.spriteWidth <= 0 ||
        result.spriteHeight <= 0 ||
        result.stringGeometry <= 0
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
    const result = await page.evaluate(() => {
      const read = (id) => {
        const svg = document.querySelector(`#${id}`);
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
    });
    if (app.verifiesFunctionEvents) {
      await page.click("#static");
      result.functionEventCount = await page.evaluate(() => window.__vadivamFunctionEventCount ?? 0);
    }
    if (errors.length) throw new Error(`${app.name}: ${errors.join(" | ")}`);
    const icon = result.staticIcon;
    const classNames = icon.className?.split(/\s+/) ?? [];
    if (icon.tag?.toLowerCase() !== "svg" || icon.width !== "48" || icon.height !== "48" || icon.stroke !== "navy" || icon.strokeWidth !== "1" || icon.paths === 0 || result.title !== "Activity chart" || icon.role !== "img" || icon.ariaHidden !== null || icon.custom !== "yes" || !classNames.includes("vadivam") || !classNames.includes("vadivam-activity") || !classNames.includes("context-icon") || !classNames.includes("consumer-icon") || classNames.length !== new Set(classNames).size) {
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
    if (server.exitCode === null && server.signalCode === null) {
      const exited = once(server, "exit");
      server.kill("SIGTERM");
      await exited;
    }
  }
}

let browserPromise;

async function validateIntegrationApp(app, index) {
  const startedAt = performance.now();
  const cwd = path.join(integrationDir, app.name);
  if (!existsSync(cwd)) throw new Error(`integration app missing: ${cwd}`);
  await run("bun", ["install", "--frozen-lockfile"], cwd);
  for (const packageName of app.packages) materializePackage(cwd, packageName);
  const manifest = JSON.parse(readFileSync(path.join(cwd, "package.json"), "utf8"));
  if (manifest.scripts?.typecheck && !app.buildIncludesTypecheck) {
    await run("bun", ["run", "typecheck"], cwd);
  }
  await run("bun", ["run", "build"], cwd);
  if (app.output) {
    browserPromise ??= launchBrowser();
    await verifyBrowser(await browserPromise, app, cwd, index);
  }
  console.log(
    `[integration] ${app.name} passed in ${((performance.now() - startedAt) / 1000).toFixed(2)}s`,
  );
}

async function validateIntegrationApps(concurrency) {
  let nextIndex = 0;
  let firstError;
  const workers = Array.from(
    { length: Math.min(concurrency, apps.length) },
    async () => {
      while (!firstError) {
        const index = nextIndex;
        nextIndex += 1;
        const app = apps[index];
        if (!app) return;
        try {
          await validateIntegrationApp(app, index);
        } catch (error) {
          firstError ??= error;
        }
      }
    },
  );
  await Promise.all(workers);
  if (firstError) throw firstError;
}

try {
  await validateIntegrationApps(3);
  console.log(`\nIntegration builds passed for: ${apps.map(({ name }) => name).join(", ")}`);
} finally {
  if (browserPromise) await (await browserPromise).close();
}
