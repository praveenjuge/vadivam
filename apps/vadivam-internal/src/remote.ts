// Reads the newest published icon set from GitHub `main` or npm `latest`, so
// the library can pick up icons added after this plugin build. Everything
// fetched here is untrusted: names and SVGs pass the same narrow checks the
// repository applies before they reach `figma.createNodeFromSvg`.

export const REMOTE_SOURCES = ["github", "npm"] as const;

export type RemoteSource = (typeof REMOTE_SOURCES)[number];

export interface RemoteIcon {
  name: string;
  svg: string;
}

export interface RemoteCatalog {
  source: RemoteSource;
  /** A short label for what was read, such as `main@1a2b3c4` or `vadivam@0.0.57`. */
  version: string;
  names: string[];
  /** Fetch SVGs for these names. Icons that fail to load or validate are reported, not thrown. */
  loadSvgs(names: readonly string[]): Promise<{ icons: RemoteIcon[]; failed: RemoteFailure[] }>;
}

export interface RemoteFailure {
  name: string;
  reason: string;
}

/** The subset of `fetch` both Figma's main thread and browsers provide. */
export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

const OWNER = "praveenjuge";
const REPO = "vadivam";
const PACKAGE = "vadivam";
const MAX_ICONS = 10_000;
const MAX_SVG_LENGTH = 100_000;
const FETCH_CONCURRENCY = 8;
// Matches the canonical source files and the published package's SVGs.
const SVG_OPEN_TAG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';

export function isRemoteSource(value: unknown): value is RemoteSource {
  return (REMOTE_SOURCES as readonly unknown[]).includes(value);
}

export function isIconName(value: unknown): value is string {
  return typeof value === "string" && value.length <= 80 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

// Every published icon is exactly the canonical root tag followed by path
// elements that carry only path data (the shape `bun run icons:check` enforces
// and the homepage build rebuilds icons from). Requiring that exact shape
// rejects fills, styles, links, scripts, and any other element or attribute.
// Written out rather than built from SVG_OPEN_TAG so it stays a literal; the
// canonical-icon test fails if the two ever disagree.
const CANONICAL_SVG =
  /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\s*(?:<path d="[MLHVCSQTAZmlhvcsqtaz0-9.,eE+\s-]+"\/>)+\s*<\/svg>$/;

export function validateRemoteSvg(svg: string): string | null {
  if (svg.length === 0 || svg.length > MAX_SVG_LENGTH) return "SVG is empty or too large";
  if (!CANONICAL_SVG.test(svg.trim())) {
    return "Not a canonical Vadivam SVG (24×24, 2 px currentColor stroke, path data only)";
  }
  return null;
}

// Figma's main-thread sandbox may lack `URL`, so read the host by hand.
const host = (url: string) => url.replace(/^https:\/\//, "").split("/")[0] ?? url;

async function fetchText(fetchImpl: FetchLike, url: string, accept = "*/*"): Promise<string> {
  let response;
  try {
    response = await fetchImpl(url, { headers: { Accept: accept } });
  } catch {
    throw new Error(`Couldn't reach ${host(url)}`);
  }
  if (!response.ok) throw new Error(`${host(url)} answered HTTP ${response.status}`);
  return response.text();
}

async function fetchJson(fetchImpl: FetchLike, url: string): Promise<Record<string, unknown>> {
  const text = await fetchText(fetchImpl, url, "application/vnd.github+json, application/json");
  try {
    const value: unknown = JSON.parse(text);
    if (value && typeof value === "object") return value as Record<string, unknown>;
  } catch {
    // Reported below.
  }
  throw new Error(`Unexpected response from ${host(url)}`);
}

function uniqueSortedNames(names: Iterable<string>): string[] {
  const list = [...new Set(names)].filter(isIconName).sort((left, right) => left.localeCompare(right));
  if (list.length === 0) throw new Error("The source lists no icons");
  if (list.length > MAX_ICONS) throw new Error("The source lists too many icons");
  return list;
}

async function mapLimit<T, R>(items: readonly T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function treeEntries(tree: Record<string, unknown>): Array<{ path: string; type: string; sha: string }> {
  if (tree.truncated === true || !Array.isArray(tree.tree)) {
    throw new Error("GitHub returned an incomplete file list");
  }
  return tree.tree.filter(
    (entry): entry is { path: string; type: string; sha: string } =>
      !!entry &&
      typeof entry.path === "string" &&
      typeof entry.type === "string" &&
      typeof entry.sha === "string",
  );
}

/**
 * GitHub `main`: resolve the branch to one commit, list `icons/` at that
 * commit, and read only the SVGs asked for from the same commit, so names and
 * artwork always agree even if `main` moves meanwhile.
 */
async function loadGitHub(fetchImpl: FetchLike): Promise<RemoteCatalog> {
  const api = `https://api.github.com/repos/${OWNER}/${REPO}`;
  const commit = await fetchJson(fetchImpl, `${api}/commits/main`);
  const sha = commit.sha;
  if (typeof sha !== "string" || !/^[0-9a-f]{40}$/.test(sha)) throw new Error("GitHub returned no commit for main");
  const root = treeEntries(await fetchJson(fetchImpl, `${api}/git/trees/${sha}`));
  const iconsTree = root.find((entry) => entry.path === "icons" && entry.type === "tree");
  if (!iconsTree) throw new Error("GitHub main has no icons folder");
  const names = uniqueSortedNames(
    treeEntries(await fetchJson(fetchImpl, `${api}/git/trees/${iconsTree.sha}`))
      .filter((entry) => entry.type === "blob" && entry.path.endsWith(".svg"))
      .map((entry) => entry.path.slice(0, -4)),
  );
  const available = new Set(names);
  return {
    source: "github",
    version: `main@${sha.slice(0, 7)}`,
    names,
    async loadSvgs(requested) {
      const failed: RemoteFailure[] = [];
      const loaded = await mapLimit(requested, FETCH_CONCURRENCY, async (name) => {
        if (!available.has(name)) {
          failed.push({ name, reason: "Not in this commit" });
          return null;
        }
        try {
          const svg = (await fetchText(fetchImpl, `https://raw.githubusercontent.com/${OWNER}/${REPO}/${sha}/icons/${name}.svg`)).trim();
          const problem = validateRemoteSvg(svg);
          if (problem) {
            failed.push({ name, reason: problem });
            return null;
          }
          return { name, svg };
        } catch (error) {
          failed.push({ name, reason: error instanceof Error ? error.message : "Download failed" });
          return null;
        }
      });
      return { icons: loaded.filter((icon): icon is RemoteIcon => icon !== null), failed };
    },
  };
}

/** Split the published `sprite.svg` into one standalone SVG per icon. */
export function parseSprite(sprite: string, prefix = `${PACKAGE}-`): Map<string, string> {
  const icons = new Map<string, string>();
  const symbol = /<symbol id="([^"]+)" viewBox="0 0 24 24">([\s\S]*?)<\/symbol>/g;
  // An exec loop rather than matchAll, which Figma's sandbox may lack.
  for (let match = symbol.exec(sprite); match; match = symbol.exec(sprite)) {
    const id = match[1] ?? "";
    const name = id.startsWith(prefix) ? id.slice(prefix.length) : "";
    if (!isIconName(name)) continue;
    const body = (match[2] ?? "").trim().replace(/\s*\n\s*/g, "");
    icons.set(name, `${SVG_OPEN_TAG}\n${body}\n</svg>`);
  }
  return icons;
}

/**
 * npm `latest`: resolve the dist-tag to an exact version, then read that
 * version's sprite from jsDelivr. One download carries every icon.
 */
async function loadNpm(fetchImpl: FetchLike): Promise<RemoteCatalog> {
  const latest = await fetchJson(fetchImpl, `https://registry.npmjs.org/${PACKAGE}/latest`);
  const version = latest.version;
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(version)) {
    throw new Error("npm returned no version for vadivam");
  }
  const sprite = parseSprite(
    await fetchText(fetchImpl, `https://cdn.jsdelivr.net/npm/${PACKAGE}@${version}/dist/sprite.svg`, "image/svg+xml"),
  );
  const names = uniqueSortedNames(sprite.keys());
  return {
    source: "npm",
    version: `${PACKAGE}@${version}`,
    names,
    async loadSvgs(requested) {
      const icons: RemoteIcon[] = [];
      const failed: RemoteFailure[] = [];
      for (const name of requested) {
        const svg = sprite.get(name);
        const problem = svg === undefined ? "Not in this version" : validateRemoteSvg(svg);
        if (problem || svg === undefined) failed.push({ name, reason: problem ?? "Not in this version" });
        else icons.push({ name, svg });
      }
      return { icons, failed };
    },
  };
}

export function loadRemoteCatalog(source: RemoteSource, fetchImpl: FetchLike): Promise<RemoteCatalog> {
  return source === "github" ? loadGitHub(fetchImpl) : loadNpm(fetchImpl);
}
