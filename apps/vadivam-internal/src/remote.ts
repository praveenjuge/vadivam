// Reads the newest published icon set from GitHub `main` or npm `latest`, so
// the library can pick up icons added after this plugin build. Everything
// fetched here is untrusted: names and SVGs must have the exact shape of a
// canonical icon file before they reach `figma.createNodeFromSvg`.
import {
  canvasAttributes,
  geometryAttributes,
  iconSvg,
  isIconName,
  packagePath,
  rootTag,
  styles,
} from "../../../scripts/icon-styles.mjs";
import type { IconStyle } from "../../figma-shared/icons";
import { messageFromError } from "../../figma-shared/channel";

export type RemoteSource = "github" | "npm";

export function isRemoteSource(value: unknown): value is RemoteSource {
  return value === "github" || value === "npm";
}

export interface RemoteIcon {
  name: string;
  svg: string;
}

export interface RemoteFailure {
  name: string;
  reason: string;
}

export interface RemoteCatalog {
  source: RemoteSource;
  style: IconStyle;
  /** A short label for what was read, such as `main@1a2b3c4` or `vadivam@0.0.57`. */
  version: string;
  names: string[];
  /** Fetch SVGs for these names. Icons that fail to load or validate are reported, not thrown. */
  loadSvgs(names: readonly string[]): Promise<{ icons: RemoteIcon[]; failed: RemoteFailure[] }>;
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

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
// Geometry values are numbers, path commands, and separators: no quotes,
// markup, entities, or URLs can appear in them.
const GEOMETRY_VALUE = '"[MLHVCSQTAZmlhvcsqtaz0-9.,eE+\\s-]*"';
const ELEMENT = Object.entries(geometryAttributes)
  .map(([tag, attributes]) => `<${tag}(?:\\s+(?:${attributes.join("|")})=${GEOMETRY_VALUE})+\\s*\\/>`)
  .join("|");

// An icon file is its style's exact root tag around elements that carry only
// geometry, the shape `bun run icons:check` enforces. Anything else (fills,
// styles, links, scripts, other elements or attributes) fails the match.
const canonicalSvg = Object.fromEntries(
  Object.values(styles).map((style) => [
    style.id,
    new RegExp(`^${escapeRegExp(rootTag(style))}\\s*(?:(?:${ELEMENT})\\s*)+<\\/svg>$`),
  ]),
) as Record<IconStyle, RegExp>;

export function validateRemoteSvg(svg: string, style: IconStyle): string | null {
  if (svg.length === 0 || svg.length > MAX_SVG_LENGTH) return "SVG is empty or too large";
  if (!canonicalSvg[style].test(svg.trim())) return `Not a canonical ${style} Vadivam SVG`;
  return null;
}

// Figma's main-thread sandbox may lack `URL`, so read the host by hand.
const host = (url: string) => url.replace(/^https:\/\//, "").split("/")[0] ?? url;

async function fetchText(fetchImpl: FetchLike, url: string, accept = "*/*"): Promise<string> {
  let response;
  try {
    response = await fetchImpl(url, { headers: { Accept: accept } });
  } catch {
    // A failed fetch rejects with an opaque TypeError; naming the host is more useful.
    throw new Error(`Couldn't reach ${host(url)}`);
  }
  if (!response.ok) throw new Error(`${host(url)} answered HTTP ${response.status}`);
  return response.text();
}

async function fetchJson(fetchImpl: FetchLike, url: string): Promise<Record<string, unknown>> {
  const text = await fetchText(fetchImpl, url, "application/vnd.github+json, application/json");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    value = null;
  }
  if (!value || typeof value !== "object") throw new Error(`Unexpected response from ${host(url)}`);
  return value as Record<string, unknown>;
}

// Code-unit order, like the repository's own icon lists.
function uniqueSortedNames(names: Iterable<string>): string[] {
  const list = [...new Set(names)].filter(isIconName).sort();
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
      !!entry && typeof entry.path === "string" && typeof entry.type === "string" && typeof entry.sha === "string",
  );
}

/**
 * GitHub `main`: resolve the branch to one commit, list the style's folder at
 * that commit, and read only the SVGs asked for from the same commit, so names
 * and artwork always agree even if `main` moves meanwhile.
 */
async function loadGitHub(fetchImpl: FetchLike, style: IconStyle): Promise<RemoteCatalog> {
  const folder = styles[style].sourceDirectory;
  const api = `https://api.github.com/repos/${OWNER}/${REPO}`;
  const commit = await fetchJson(fetchImpl, `${api}/commits/main`);
  const sha = commit.sha;
  if (typeof sha !== "string" || !/^[0-9a-f]{40}$/.test(sha)) throw new Error("GitHub returned no commit for main");
  const root = treeEntries(await fetchJson(fetchImpl, `${api}/git/trees/${sha}`));
  const iconsTree = root.find((entry) => entry.path === folder && entry.type === "tree");
  if (!iconsTree) throw new Error(`GitHub main has no ${folder} folder`);
  const names = uniqueSortedNames(
    treeEntries(await fetchJson(fetchImpl, `${api}/git/trees/${iconsTree.sha}`))
      .filter((entry) => entry.type === "blob" && entry.path.endsWith(".svg"))
      .map((entry) => entry.path.slice(0, -".svg".length)),
  );
  const available = new Set(names);
  return {
    source: "github",
    style,
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
          const svg = await fetchText(fetchImpl, `https://raw.githubusercontent.com/${OWNER}/${REPO}/${sha}/${folder}/${name}.svg`);
          const problem = validateRemoteSvg(svg, style);
          if (problem) {
            failed.push({ name, reason: problem });
            return null;
          }
          return { name, svg: svg.trim() };
        } catch (error) {
          failed.push({ name, reason: messageFromError(error) });
          return null;
        }
      });
      return { icons: loaded.filter((icon): icon is RemoteIcon => icon !== null), failed };
    },
  };
}

/** Split a style's published `sprite.svg` into one icon file per symbol. */
export function parseSprite(sprite: string, style: IconStyle): Map<string, string> {
  const { spriteIdPrefix } = styles[style];
  const icons = new Map<string, string>();
  const symbol = new RegExp(`<symbol id="([^"]+)" viewBox="${canvasAttributes.viewBox}">([\\s\\S]*?)<\\/symbol>`, "g");
  // An exec loop rather than matchAll, which Figma's sandbox may lack.
  for (let match = symbol.exec(sprite); match; match = symbol.exec(sprite)) {
    const id = match[1] ?? "";
    const name = id.startsWith(spriteIdPrefix) ? id.slice(spriteIdPrefix.length) : "";
    if (!isIconName(name)) continue;
    const body = (match[2] ?? "").trim().replace(/\s*\n\s*/g, "");
    icons.set(name, iconSvg(styles[style], body).trim());
  }
  return icons;
}

/**
 * npm `latest`: resolve the dist-tag to an exact version, then read that
 * version's sprite for the style from jsDelivr. One download carries every icon.
 */
async function loadNpm(fetchImpl: FetchLike, style: IconStyle): Promise<RemoteCatalog> {
  const latest = await fetchJson(fetchImpl, `https://registry.npmjs.org/${PACKAGE}/latest`);
  const version = latest.version;
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(version)) {
    throw new Error(`npm returned no version for ${PACKAGE}`);
  }
  const spriteUrl = `https://cdn.jsdelivr.net/npm/${PACKAGE}@${version}/${packagePath(styles[style], "sprite.svg")}`;
  const sprite = parseSprite(await fetchText(fetchImpl, spriteUrl, "image/svg+xml"), style);
  return {
    source: "npm",
    style,
    version: `${PACKAGE}@${version}`,
    names: uniqueSortedNames(sprite.keys()),
    async loadSvgs(requested) {
      const icons: RemoteIcon[] = [];
      const failed: RemoteFailure[] = [];
      for (const name of requested) {
        const svg = sprite.get(name);
        const problem = svg === undefined ? "Not in this version" : validateRemoteSvg(svg, style);
        if (svg === undefined || problem) failed.push({ name, reason: problem ?? "Not in this version" });
        else icons.push({ name, svg });
      }
      return { icons, failed };
    },
  };
}

export function loadRemoteCatalog(source: RemoteSource, fetchImpl: FetchLike, style: IconStyle): Promise<RemoteCatalog> {
  return source === "github" ? loadGitHub(fetchImpl, style) : loadNpm(fetchImpl, style);
}
