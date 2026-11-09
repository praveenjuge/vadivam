import { describe, expect, test } from "bun:test";
import type { IconStyle } from "../../figma-shared/icons";
import { loadRemoteCatalog, parseSprite, validateRemoteSvg, type FetchLike } from "../src/remote";
import { canonicalIcons, publishedSprite } from "./published-sprite.mjs";

const fixtures = Object.fromEntries(
  await Promise.all(
    (["outline", "solid"] as const).map(async (style) => [
      style,
      { icons: await canonicalIcons(style), sprite: await publishedSprite(style) },
    ]),
  ),
) as Record<IconStyle, { icons: Array<{ name: string; svg: string }>; sprite: string }>;

const sha = "0123456789abcdef0123456789abcdef01234567";
const api = "https://api.github.com/repos/praveenjuge/vadivam";

function fakeFetch(routes: Record<string, string | number>, calls: string[] = []): FetchLike {
  return async (url) => {
    calls.push(url);
    const body = routes[url] ?? 404;
    if (typeof body === "number") return { ok: false, status: body, text: async () => "" };
    return { ok: true, status: 200, text: async () => body };
  };
}

describe.each(["outline", "solid"] as const)("%s icons from GitHub or npm", (style) => {
  const { icons, sprite } = fixtures[style];
  const svgOf = (name: string) => icons.find((icon) => icon.name === name)!.svg;
  const other: IconStyle = style === "outline" ? "solid" : "outline";

  test("every canonical file passes, and only for its own style", () => {
    for (const icon of icons) expect(validateRemoteSvg(icon.svg, style)).toBeNull();
    expect(validateRemoteSvg(svgOf("bell"), other)).not.toBeNull();
  });

  test("the published sprite splits back into every canonical file", () => {
    const parsed = parseSprite(sprite, style);
    expect([...parsed.keys()]).toEqual(icons.map((icon) => icon.name));
    for (const icon of icons) expect(parsed.get(icon.name)).toBe(icon.svg.trim());
  });

  test("npm resolves latest to one version and reads that version's sprite", async () => {
    const calls: string[] = [];
    const spritePath = style === "solid" ? "dist/solid/sprite.svg" : "dist/sprite.svg";
    const remote = await loadRemoteCatalog(
      "npm",
      fakeFetch(
        {
          "https://registry.npmjs.org/vadivam/latest": JSON.stringify({ version: "9.9.9" }),
          [`https://cdn.jsdelivr.net/npm/vadivam@9.9.9/${spritePath}`]: sprite,
        },
        calls,
      ),
      style,
    );
    expect(remote.version).toBe("vadivam@9.9.9");
    expect(remote.names).toEqual(icons.map((icon) => icon.name).sort());
    const { icons: loaded, failed } = await remote.loadSvgs(["bell", "no-such-icon"]);
    expect(loaded).toEqual([{ name: "bell", svg: svgOf("bell").trim() }]);
    expect(failed).toEqual([{ name: "no-such-icon", reason: "Not in this version" }]);
    expect(calls).toHaveLength(2);
  });

  test("GitHub pins main to one commit and downloads only what is asked for", async () => {
    const folder = style === "solid" ? "icons-solid" : "icons";
    const raw = `https://raw.githubusercontent.com/praveenjuge/vadivam/${sha}/${folder}`;
    const calls: string[] = [];
    const remote = await loadRemoteCatalog(
      "github",
      fakeFetch(
        {
          [`${api}/commits/main`]: JSON.stringify({ sha }),
          [`${api}/git/trees/${sha}`]: JSON.stringify({
            truncated: false,
            tree: [
              { path: "README.md", type: "blob", sha: "a" },
              { path: folder, type: "tree", sha: "icons-tree" },
            ],
          }),
          [`${api}/git/trees/icons-tree`]: JSON.stringify({
            truncated: false,
            tree: ["bell.svg", "bad.svg", "Not Valid.svg", "gone.svg", "notes.txt"].map((path) => ({ path, type: "blob", sha: path })),
          }),
          [`${raw}/bell.svg`]: svgOf("bell"),
          [`${raw}/bad.svg`]: svgOf("bell").replace("<path ", "<script>alert(1)</script><path "),
          [`${raw}/gone.svg`]: 503,
        },
        calls,
      ),
      style,
    );
    expect(remote.version).toBe("main@0123456");
    expect(remote.names).toEqual(["bad", "bell", "gone"]);
    const { icons: loaded, failed } = await remote.loadSvgs(["bad", "bell", "gone"]);
    expect(loaded).toEqual([{ name: "bell", svg: svgOf("bell").trim() }]);
    expect(failed.map((failure) => failure.name).sort()).toEqual(["bad", "gone"]);
    expect(calls.filter((url) => url.startsWith(raw))).toHaveLength(3);
  });
});

describe("validateRemoteSvg", () => {
  const bell = fixtures.outline.icons.find((icon) => icon.name === "bell")!.svg;

  test("rejects anything that could load or run, or that isn't a canonical drawing", () => {
    const open = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">';
    for (const svg of [
      "",
      "not svg",
      `${open}<script>alert(1)</script></svg>`,
      `${open}<path d="M0 0" onload="x()"/></svg>`,
      `${open}<image href="https://example.com/a.png"/></svg>`,
      `${open}<foreignObject></foreignObject></svg>`,
      bell.replace('fill="none"', 'fill="red"'),
      bell.replace("<path ", '<path fill="red" '),
      bell.replace("<path ", '<path style="fill:red" '),
      bell.replace('d="', 'd="url(#x) '),
      bell.replace("</svg>", "<use href=\"#a\"/></svg>"),
      "x".repeat(100_001),
    ]) {
      expect(validateRemoteSvg(svg, "outline")).not.toBeNull();
    }
  });

  test("accepts every drawing element the icon contract allows", () => {
    expect(validateRemoteSvg(bell.replace("</svg>", '<circle cx="12" cy="12" r="10"/></svg>'), "outline")).toBeNull();
  });
});

describe("loadRemoteCatalog", () => {
  test("GitHub refuses a truncated listing instead of adding a partial set", async () => {
    const fetchImpl = fakeFetch({
      [`${api}/commits/main`]: JSON.stringify({ sha }),
      [`${api}/git/trees/${sha}`]: JSON.stringify({ truncated: true, tree: [] }),
    });
    await expect(loadRemoteCatalog("github", fetchImpl, "outline")).rejects.toThrow("incomplete");
  });

  test("reports an unreachable source by host", async () => {
    const fetchImpl = fakeFetch({ "https://registry.npmjs.org/vadivam/latest": 500 });
    await expect(loadRemoteCatalog("npm", fetchImpl, "outline")).rejects.toThrow("registry.npmjs.org answered HTTP 500");
    const offline: FetchLike = async () => {
      throw new TypeError("Failed to fetch");
    };
    await expect(loadRemoteCatalog("npm", offline, "solid")).rejects.toThrow("Couldn't reach registry.npmjs.org");
  });
});
