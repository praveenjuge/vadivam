import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  categories,
  closestIconNames,
  findIcon,
  icons,
  renderIcon,
  searchIcons,
  suggestIcons,
  usageFor,
  version,
} from "../../packages/vadivam-mcp/dist/index.js";

const root = new URL("../../", import.meta.url);
const packageVersion = JSON.parse(
  readFileSync(new URL("packages/vadivam-mcp/package.json", root), "utf8"),
).version;
const names = (result) => result.results.map((icon) => icon.name);

describe("vadivam-mcp data", () => {
  test("bundles every icon and category from the release", () => {
    const sourceCount = readFileSync(new URL("README.md", root), "utf8").match(
      /library of (\d+) pixel-perfect/,
    )[1];
    expect(icons.length).toBe(Number(sourceCount));
    expect(categories.length).toBeGreaterThan(30);
    expect(version).toBe(packageVersion);
    for (const icon of icons) {
      expect(icon.svg.startsWith("<svg")).toBe(true);
      for (const id of icon.categories) {
        expect(categories.some((category) => category.id === id)).toBe(true);
      }
    }
  });
});

describe("search_icons ranking", () => {
  test("an exact name ranks first", () => {
    expect(names(searchIcons("arrow-right"))[0]).toBe("arrow-right");
    expect(names(searchIcons("arrow right"))[0]).toBe("arrow-right");
    expect(names(searchIcons("ArrowRight"))[0]).toBe("arrow-right");
    expect(names(searchIcons("trash"))[0]).toBe("trash");
  });

  test("name prefixes and name words rank above tags", () => {
    const results = names(searchIcons("arrow", { limit: 100 }));
    const firstTagOnly = results.findIndex((name) => !name.includes("arrow"));
    const lastNamed = results.findLastIndex((name) => name.startsWith("arrow"));
    expect(results[0].startsWith("arrow-")).toBe(true);
    if (firstTagOnly !== -1) expect(lastNamed).toBeLessThan(firstTagOnly);
  });

  test("tags find synonyms", () => {
    const results = names(searchIcons("delete", { limit: 20 }));
    expect(results).toContain("trash");
    expect(results.indexOf("delete")).toBe(0);
  });

  test("symbol-only tags match exactly", () => {
    expect(names(searchIcons("->|"))).toContain("arrow-right-to-line");
    expect(names(searchIcons("@"))).toContain("at-sign");
    expect(names(searchIcons("  "))).toEqual([]);
  });

  test("tags rank above category titles", () => {
    const icon = icons.find((candidate) => candidate.tags.includes("weather"));
    const results = searchIcons("weather", { limit: 100 }).results;
    const tagged = results.findIndex((result) => result.name === icon.name);
    const categoryOnly = results.findIndex(
      (result) =>
        !result.name.includes("weather") &&
        !icons.find((candidate) => candidate.name === result.name).tags.some((tag) => tag.includes("weather")),
    );
    expect(tagged).toBeGreaterThanOrEqual(0);
    if (categoryOnly !== -1) expect(tagged).toBeLessThan(categoryOnly);
  });

  test("every query word must match", () => {
    expect(names(searchIcons("user add"))).toContain("user-plus");
    expect(searchIcons("zzzz qqqq").total).toBe(0);
  });

  test("returns the compact result shape", () => {
    const [first] = searchIcons("activity").results;
    expect(first).toEqual({
      name: "activity",
      componentName: "Activity",
      categories: expect.any(Array),
      tags: expect.any(Array),
      url: "https://vadivam.praveenjuge.com/icons/activity",
    });
    for (const result of searchIcons("a", { limit: 100 }).results) {
      expect(result.tags.length).toBeLessThanOrEqual(8);
    }
  });

  test("limits results to 1..100 and defaults to 20", () => {
    expect(searchIcons("a").results).toHaveLength(20);
    expect(searchIcons("a", { limit: 5 }).results).toHaveLength(5);
    expect(searchIcons("a", { limit: 1000 }).results).toHaveLength(100);
    expect(searchIcons("a", { limit: 0 }).results).toHaveLength(20);
  });

  test("filters by category id or title, and browses a category alphabetically", () => {
    const weather = categories.find((category) => category.id === "weather");
    for (const result of searchIcons("sun", { category: "weather" }).results) {
      expect(result.categories).toContain("weather");
    }
    expect(searchIcons("sun", { category: weather.title }).category).toBe("weather");
    const browse = names(searchIcons("", { category: "weather", limit: 100 }));
    expect(browse.length).toBeGreaterThan(0);
    expect(browse).toEqual([...browse].sort((a, b) => a.localeCompare(b)));
    expect(() => searchIcons("sun", { category: "nope" })).toThrow(/Unknown category/);
    expect(searchIcons("").total).toBe(0);
  });
});

describe("suggest_icons", () => {
  const top = (result) =>
    Object.fromEntries(result.concepts.map(({ concept, results }) => [concept, results[0]?.name]));

  test("splits a description into concepts and drops filler words", () => {
    const result = suggestIcons("A settings page with search, user profile and the logout button");
    expect(result.concepts.map(({ concept }) => concept)).toEqual(["settings", "search", "user profile", "logout"]);
    expect(top(result)).toMatchObject({ settings: "settings", search: "search", logout: "log-out" });
    expect(result.unmatched).toEqual([]);
  });

  test("ranks icons named for the concept first, then by popularity", () => {
    const result = suggestIcons("cart, notifications, messages");
    expect(top(result)).toEqual({ cart: "shopping-cart", notifications: "bell", messages: "message-circle" });
  });

  test("falls back to single words when a phrase matches nothing", () => {
    const result = suggestIcons("upload dropzone");
    expect(result.concepts.map(({ concept }) => concept)).toEqual(["upload"]);
    expect(result.unmatched).toEqual(["dropzone"]);
  });

  test("limits candidates per concept to 1..10 and defaults to 3", () => {
    expect(suggestIcons("arrow").concepts[0].results).toHaveLength(3);
    expect(suggestIcons("arrow", { perConcept: 50 }).concepts[0].results).toHaveLength(10);
    expect(suggestIcons("arrow", { perConcept: 1 }).concepts[0].results).toHaveLength(1);
    expect(suggestIcons("the page")).toEqual({ description: "the page", concepts: [], unmatched: [] });
  });
});

describe("icon lookup", () => {
  test("accepts kebab and component names", () => {
    expect(findIcon("arrow-right")?.name).toBe("arrow-right");
    expect(findIcon("ArrowRight")?.name).toBe("arrow-right");
    expect(findIcon("ArrowRightIcon")?.name).toBe("arrow-right");
    expect(findIcon("VadivamArrowRight")?.name).toBe("arrow-right");
    expect(findIcon("not-an-icon")).toBeUndefined();
  });

  test("suggests up to five close names for a misspelling", () => {
    const suggestions = closestIconNames("acitvity");
    expect(suggestions).toHaveLength(5);
    expect(suggestions[0]).toBe("activity");
    for (const name of suggestions) expect(findIcon(name)).toBeDefined();
  });
});

describe("get_icon formats", () => {
  const activity = findIcon("activity");

  test("svg applies size, color, and stroke settings", () => {
    expect(renderIcon(activity)).toBe(activity.svg);
    const svg = renderIcon(activity, "svg", { size: 32, color: "#f00", strokeWidth: 1.5 });
    expect(svg).toContain('width="32"');
    expect(svg).toContain('height="32"');
    expect(svg).toContain('stroke="#f00"');
    expect(svg).toContain('stroke-width="1.5"');
    expect(renderIcon(activity, "svg", { size: 48, absoluteStrokeWidth: true })).toContain(
      'stroke-width="1"',
    );
  });

  test("jsx, data URIs, and CSS masks", () => {
    expect(renderIcon(activity, "jsx")).toContain("strokeWidth=");
    expect(renderIcon(activity, "data-uri")).toMatch(/^data:image\/svg\+xml,/);
    const base64 = renderIcon(activity, "base64");
    expect(base64).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(atob(base64.split(",")[1])).toBe(activity.svg);
    expect(renderIcon(activity, "css-mask")).toContain(".icon-activity");
    const mask = renderIcon(activity, "css-mask", { size: 48, strokeWidth: 1.5 });
    expect(mask).toContain("width: 48px;");
    expect(mask).toContain("stroke-width='1.5'");
    expect(renderIcon(activity, "tailwind", { size: 20 })).toContain("size-[20px] bg-current [mask:url(data:image/svg+xml;base64,");
  });

  test("framework snippets import from the matching package", () => {
    const packages = {
      react: "vadivam-react",
      "react-native": "vadivam-react-native",
      vue: "vadivam-vue",
      svelte: "vadivam-svelte",
      solid: "vadivam-solid",
      preact: "vadivam-preact",
      astro: "vadivam-astro",
      angular: "vadivam-angular",
    };
    for (const [format, packageName] of Object.entries(packages)) {
      const code = renderIcon(activity, format, { size: 20 });
      expect(code).toContain(`from "${packageName}"`);
      expect(code).toContain("Activity");
      expect(code).toContain("20");
    }
  });

  test("asset and integration formats", () => {
    expect(renderIcon(activity, "cdn")).toBe(
      `https://cdn.jsdelivr.net/npm/vadivam@${version}/dist/icons/activity.svg`,
    );
    expect(renderIcon(activity, "sprite")).toContain("#vadivam-activity");
    expect(renderIcon(activity, "font")).toContain("vadivam-icon-activity");
    expect(renderIcon(activity, "iconify")).toBe("vadivam:activity");
    expect(renderIcon(activity, "shadcn")).toBe(
      "npx shadcn@latest add https://vadivam.praveenjuge.com/r/activity.json",
    );
    expect(() => renderIcon(activity, "png")).toThrow(/Unknown format/);
  });
});

describe("get_usage", () => {
  test("links each framework to its docs page", () => {
    for (const framework of ["core", "react", "react-native", "vue", "svelte", "solid", "angular", "astro", "preact"]) {
      const usage = usageFor(framework);
      expect(usage.docs).toBe(`https://vadivam.praveenjuge.com/docs/${framework}`);
      expect(usage.install).toStartWith(`npm install ${usage.packageName}`);
      expect(usage.example).toContain(usage.packageName);
    }
    expect(usageFor("react-native").install).toContain("react-native-svg");
  });
});
