import { describe, expect, test } from "bun:test";
import {
  loadRemoteCatalog,
  parseSprite,
  validateRemoteSvg,
  type FetchLike,
} from "../src/remote";
import { canonicalIcons, publishedSprite } from "./published-sprite.mjs";

const icons = await canonicalIcons();
const realSprite = publishedSprite;

function fakeFetch(routes: Record<string, string | number>, calls: string[] = []): FetchLike {
  return async (url) => {
    calls.push(url);
    const body = routes[url];
    if (body === undefined) return { ok: false, status: 404, text: async () => "" };
    if (typeof body === "number") return { ok: false, status: body, text: async () => "" };
    return { ok: true, status: 200, text: async () => body };
  };
}

describe("remote icon sources", () => {
  test("the published sprite splits back into every canonical SVG", async () => {
    const parsed = parseSprite(await realSprite());
    expect(parsed.size).toBe(icons.length);
    for (const icon of icons) expect(parsed.get(icon.name)).toBe(icon.svg.trim());
  });

  test("accepts canonical icons and rejects anything that could load or run", () => {
    for (const icon of icons) expect(validateRemoteSvg(icon.svg)).toBeNull();
    const open = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">';
    expect(validateRemoteSvg(`${open}<script>alert(1)</script></svg>`)).not.toBeNull();
    expect(validateRemoteSvg(`${open}<path d="M0 0" onload="x()"/></svg>`)).not.toBeNull();
    expect(validateRemoteSvg(`${open}<image href="https://example.com/a.png"/></svg>`)).not.toBeNull();
    expect(validateRemoteSvg(`${open}<path style="fill:red" d="M0 0"/></svg>`)).not.toBeNull();
    expect(validateRemoteSvg(`${open}<foreignObject></foreignObject></svg>`)).not.toBeNull();
    expect(validateRemoteSvg('<svg viewBox="0 0 48 48"><path d="M0 0"/></svg>')).not.toBeNull();
    expect(validateRemoteSvg("not svg")).not.toBeNull();
    // Harmless-looking but off-spec artwork: a filled root, a stray attribute,
    // or an extra element never reaches the library either.
    const canonical = icons.find((icon) => icon.name === "bell")!.svg;
    expect(validateRemoteSvg('<svg viewBox="0 0 24 24" fill="red"><path d="M0 0h24v24z"/></svg>')).not.toBeNull();
    expect(validateRemoteSvg(canonical.replace('fill="none"', 'fill="red"'))).not.toBeNull();
    expect(validateRemoteSvg(canonical.replace("<path ", '<path fill="red" '))).not.toBeNull();
    expect(validateRemoteSvg(canonical.replace("</svg>", '<circle cx="12" cy="12" r="10"/></svg>'))).not.toBeNull();
  });

  test("npm resolves latest to one version and reads its sprite", async () => {
    const calls: string[] = [];
    const fetchImpl = fakeFetch(
      {
        "https://registry.npmjs.org/vadivam/latest": JSON.stringify({ version: "9.9.9" }),
        "https://cdn.jsdelivr.net/npm/vadivam@9.9.9/dist/sprite.svg": await realSprite(),
      },
      calls,
    );
    const remote = await loadRemoteCatalog("npm", fetchImpl);
    expect(remote.version).toBe("vadivam@9.9.9");
    expect(remote.names).toEqual(icons.map((icon) => icon.name).sort((a, b) => a.localeCompare(b)));
    const { icons: loaded, failed } = await remote.loadSvgs(["circle-chevrons-down", "no-such-icon"]);
    expect(loaded).toEqual([
      { name: "circle-chevrons-down", svg: icons.find((icon) => icon.name === "circle-chevrons-down")!.svg.trim() },
    ]);
    expect(failed).toEqual([{ name: "no-such-icon", reason: "Not in this version" }]);
    expect(calls).toHaveLength(2);
  });

  test("GitHub pins main to one commit and downloads only what is asked for", async () => {
    const sha = "0123456789abcdef0123456789abcdef01234567";
    const api = "https://api.github.com/repos/praveenjuge/vadivam";
    const raw = `https://raw.githubusercontent.com/praveenjuge/vadivam/${sha}/icons`;
    const good = icons.find((icon) => icon.name === "bell")!.svg;
    const calls: string[] = [];
    const fetchImpl = fakeFetch(
      {
        [`${api}/commits/main`]: JSON.stringify({ sha }),
        [`${api}/git/trees/${sha}`]: JSON.stringify({
          truncated: false,
          tree: [
            { path: "README.md", type: "blob", sha: "a" },
            { path: "icons", type: "tree", sha: "icons-tree" },
          ],
        }),
        [`${api}/git/trees/icons-tree`]: JSON.stringify({
          truncated: false,
          tree: [
            { path: "bell.svg", type: "blob", sha: "b" },
            { path: "bad.svg", type: "blob", sha: "c" },
            { path: "Not Valid.svg", type: "blob", sha: "d" },
            { path: "gone.svg", type: "blob", sha: "e" },
            { path: "notes.txt", type: "blob", sha: "f" },
          ],
        }),
        [`${raw}/bell.svg`]: good,
        [`${raw}/bad.svg`]: '<svg viewBox="0 0 24 24"><script>alert(1)</script></svg>',
        [`${raw}/gone.svg`]: 503,
      },
      calls,
    );
    const remote = await loadRemoteCatalog("github", fetchImpl);
    expect(remote.version).toBe("main@0123456");
    expect(remote.names).toEqual(["bad", "bell", "gone"]);
    const { icons: loaded, failed } = await remote.loadSvgs(["bad", "bell", "gone"]);
    expect(loaded).toEqual([{ name: "bell", svg: good.trim() }]);
    expect(failed.map((failure) => failure.name).sort()).toEqual(["bad", "gone"]);
    expect(calls.filter((url) => url.startsWith(raw))).toHaveLength(3);
  });

  test("GitHub refuses a truncated listing instead of adding a partial set", async () => {
    const sha = "0123456789abcdef0123456789abcdef01234567";
    const api = "https://api.github.com/repos/praveenjuge/vadivam";
    const fetchImpl = fakeFetch({
      [`${api}/commits/main`]: JSON.stringify({ sha }),
      [`${api}/git/trees/${sha}`]: JSON.stringify({ truncated: true, tree: [] }),
    });
    await expect(loadRemoteCatalog("github", fetchImpl)).rejects.toThrow("incomplete");
  });

  test("reports an unreachable source by host", async () => {
    await expect(loadRemoteCatalog("npm", fakeFetch({ "https://registry.npmjs.org/vadivam/latest": 500 }))).rejects.toThrow(
      "registry.npmjs.org answered HTTP 500",
    );
  });
});
