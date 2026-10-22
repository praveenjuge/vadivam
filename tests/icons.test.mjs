import { describe, expect, test } from "bun:test";
import {
  fetchPinnedLucideCatalog,
  normalizeSvg,
  readIcons,
  shuffleUnique,
  updateIconCountMarkers,
  validateIconMetadata,
  validateLucideIconNames,
  validateSvgContent,
} from "../scripts/icons.mjs";
import {
  detectCircle,
  detectRoundedRect,
  gridClass,
  inkBounds,
  parsePath,
  sampleSubpath,
} from "../scripts/icon-geometry.mjs";
import {
  findUnsmoothedCorners,
  measureCorners,
  reattachEnds,
  smoothCorners,
} from "../scripts/corner-smoothing.mjs";
import { cleanPaths } from "../scripts/path-cleanup.mjs";

const validSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16"/></svg>`;

describe("icon validation", () => {
  test("accepts a valid outline SVG", () => {
    expect(() => validateSvgContent(validSvg, "valid-fixture.svg")).not.toThrow();
  });

  test("rejects filled Figma exports before normalization", () => {
    const outlinedExport = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 2h20v20H2z" fill="black"/></svg>`;
    expect(() => normalizeSvg(outlinedExport, "outlined-export.svg")).toThrow(
      "filled artwork cannot be normalized",
    );
  });

  test("rejects compound paths that look like expanded strokes", () => {
    const closedShapes = Array.from(
      { length: 9 },
      (_value, index) => `M${index} 0h1v1h-1z`,
    ).join("");
    const expandedStroke = validSvg.replace("M4 12h16", closedShapes);
    expect(() => validateSvgContent(expandedStroke, "expanded-stroke.svg")).toThrow(
      "looks like expanded stroke geometry",
    );
  });

  test.each([
    ["wrong viewBox", validSvg.replace("0 0 24 24", "0 0 32 32")],
    ["black stroke", validSvg.replace("currentColor", "black")],
    ["filled path", validSvg.replace("<path", '<path fill="red"')],
    ["square caps", validSvg.replace("round", "square")],
    ["wrong stroke width", validSvg.replace('stroke-width="2"', 'stroke-width="1.5"')],
    ["unsafe markup", validSvg.replace("<path", "<script/><path")]
  ])("rejects %s", (_name, svg) => {
    expect(() => validateSvgContent(svg, "invalid-fixture.svg")).toThrow();
  });

  test("accepts geometry that keeps the 2px stroke inside the 1px padding", () => {
    const edgeToEdge = validSvg.replace("M4 12h16", "M2 2h20v20H2z");
    expect(() => validateSvgContent(edgeToEdge, "edge-fixture.svg")).not.toThrow();
  });

  test.each([
    ["a path on the canvas edge", validSvg.replace("M4 12h16", "M0 12h24")],
    ["a path in the padding", validSvg.replace("M4 12h16", "M1.75 12h20")],
    ["a curve bulging past the padding", validSvg.replace("M4 12h16", "M2 12a10 10 0 0 1 20 0q0 10.5 0 10.5")],
    ["a circle touching the edge", validSvg.replace('<path d="M4 12h16"/>', '<circle cx="12" cy="12" r="11.5"/>')],
    ["a line past the bottom", validSvg.replace('<path d="M4 12h16"/>', '<line x1="12" y1="2" x2="12" y2="22.5"/>')],
  ])("rejects %s", (_name, svg) => {
    expect(() => validateSvgContent(svg, "overflow-fixture.svg")).toThrow(
      "stroke reaches into the 1px padding",
    );
  });

  test("rejects path data that does not parse", () => {
    const broken = validSvg.replace("M4 12h16", "M4 12h");
    expect(() => validateSvgContent(broken, "broken-path.svg")).toThrow("broken-path.svg:");
  });

  test("validates every canonical icon", async () => {
    const icons = await readIcons();
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon.svgPath).toBe(`icons/${icon.fileName}`);
      expect(icon.componentName).toMatch(/^[A-Z][A-Za-z0-9]*$/);
    }
  });

  test("loads canonical names from the pinned Lucide release", async () => {
    const requests = [];
    const fetchImpl = async (url) => {
      requests.push(url);
      if (url === "https://registry.npmjs.org/lucide/1.61.0") {
        return Response.json({ version: "1.61.0" });
      }
      return Response.json({
        truncated: false,
        tree: [
          { path: "icons/check.svg" },
          { path: "icons/columns-2.svg" },
          { path: "icons/columns-2.json" },
          { path: "packages/lucide/icons/check.svg" },
        ],
      });
    };

    const catalog = await fetchPinnedLucideCatalog(fetchImpl);
    expect(catalog.version).toBe("1.61.0");
    expect(catalog.names).toEqual(new Set(["check", "columns-2"]));
    expect(requests).toEqual([
      "https://registry.npmjs.org/lucide/1.61.0",
      "https://api.github.com/repos/lucide-icons/lucide/git/trees/1.61.0?recursive=1",
    ]);
  });

  test("authenticates GitHub API requests only, when a token is set", async () => {
    const authorization = {};
    const fetchImpl = async (url, { headers }) => {
      authorization[new URL(url).host] = headers.Authorization;
      if (url.startsWith("https://registry.npmjs.org/")) return Response.json({ version: "1.61.0" });
      return Response.json({ truncated: false, tree: [{ path: "icons/check.svg" }] });
    };
    const previous = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = "test-token";
    try {
      await fetchPinnedLucideCatalog(fetchImpl);
    } finally {
      if (previous === undefined) delete process.env.GITHUB_TOKEN;
      else process.env.GITHUB_TOKEN = previous;
    }
    expect(authorization).toEqual({ "registry.npmjs.org": undefined, "api.github.com": "Bearer test-token" });
  });

  test("rejects a registry response that does not match the pin", async () => {
    const fetchImpl = async (url) => {
      if (url === "https://registry.npmjs.org/lucide/1.61.0") {
        return Response.json({ version: "1.41.0" });
      }
      throw new Error(`Unexpected request: ${url}`);
    };

    await expect(fetchPinnedLucideCatalog(fetchImpl)).rejects.toThrow(
      "The pinned Lucide release must resolve to 1.61.0",
    );
  });

  test("accepts renamed icons and rejects their retired names through catalog parsing", async () => {
    const fetchImpl = async (url) => {
      if (url === "https://registry.npmjs.org/lucide/1.61.0") {
        return Response.json({ version: "1.61.0" });
      }
      return Response.json({
        truncated: false,
        tree: [
          { path: "icons/building-complex.svg" },
          { path: "icons/eighth-notes.svg" },
          { path: "icons/square-bookmark.svg" },
          { path: "icons/trash.svg" },
        ],
      });
    };

    const catalog = await fetchPinnedLucideCatalog(fetchImpl);
    expect(() =>
      validateLucideIconNames(
        ["building-complex.svg", "eighth-notes.svg", "square-bookmark.svg", "trash.svg"],
        catalog,
      ),
    ).not.toThrow();
    expect(() =>
      validateLucideIconNames(["album.svg", "building-2.svg", "music.svg", "trash-2.svg"], catalog),
    ).toThrow(
      "Deprecated or non-canonical icon names for Lucide 1.61.0: album.svg, building-2.svg, music.svg, trash-2.svg",
    );
  });

  test("rejects deprecated and unknown Lucide icon filenames", () => {
    const catalog = { version: "1.61.0", names: new Set(["check", "columns-2"]) };
    expect(() =>
      validateLucideIconNames(["check.svg", "columns-2.svg"], catalog),
    ).not.toThrow();
    expect(() => validateLucideIconNames(["columns.svg", "custom.svg"], catalog)).toThrow(
      "Deprecated or non-canonical icon names for Lucide 1.61.0: columns.svg, custom.svg",
    );
  });

  test("requires tags and known categories for exactly the shipped icons", () => {
    const metadata = {
      categories: { arrows: { title: "Arrows" } },
      icons: { check: { tags: ["done"], categories: ["arrows"] } },
    };
    expect(() => validateIconMetadata(["check"], metadata)).not.toThrow();
    expect(() => validateIconMetadata(["check", "x"], metadata)).toThrow("has no entry for: x");
    expect(() => validateIconMetadata([], metadata)).toThrow("lists icons with no SVG: check");
    metadata.icons.check.categories = ["unknown"];
    expect(() => validateIconMetadata(["check"], metadata)).toThrow("needs at least one known category");
  });

  test("updates every marked icon count without changing unrelated numbers", () => {
    const content = [
      "<!-- vadivam-icon-count:start -->",
      "Ships 240 icons at 24px.",
      "<!-- vadivam-icon-count:end -->",
      "Version 2 remains unchanged.",
    ].join("\n");
    expect(updateIconCountMarkers(content, 260)).toBe(
      content.replace("Ships 240 icons", "Ships 260 icons"),
    );
    expect(() => updateIconCountMarkers("Ships 240 icons.", 260)).toThrow(
      "missing vadivam icon count markers",
    );
  });
});

describe("icon geometry", () => {
  test("parses relative, shorthand, and compact arc commands to absolute segments", () => {
    const [subpath] = parsePath("m2 2h4v4H2zM10 10c1 0 2 1 2 2s1 2 2 2a2 2 0 011-1");
    expect(subpath.closed).toBe(true);
    expect(subpath.segments.map((segment) => segment.to)).toEqual([
      [6, 2],
      [6, 6],
      [2, 6],
      [2, 2],
    ]);
    const curves = parsePath("M10 10c1 0 2 1 2 2s1 2 2 2a2 2 0 011-1")[0].segments;
    expect(curves.map((segment) => segment.type)).toEqual(["C", "C", "A"]);
    expect(curves[1].c1).toEqual([12, 13]);
    expect(curves[2]).toMatchObject({ largeArc: false, sweep: true, to: [15, 13] });
  });

  test("measures the canvas keylines", () => {
    const [circle] = parsePath("M2 12a10 10 0 0 1 20 0 10 10 0 0 1-20 0");
    expect(detectCircle(circle)).toEqual({ cx: 12, cy: 12, r: 10 });
    const [square] = parsePath("M8 22h8a6 6 0 0 0 6-6V8a6 6 0 0 0-6-6H8a6 6 0 0 0-6 6v8a6 6 0 0 0 6 6");
    expect(detectRoundedRect(square)).toEqual({ x: 2, y: 2, width: 20, height: 20, r: 6, smoothing: 0 });
    const [smoothed] = parsePath(smoothCorners("M8 22h8a6 6 0 0 0 6-6V8a6 6 0 0 0-6-6H8a6 6 0 0 0-6 6v8a6 6 0 0 0 6 6"));
    expect(detectRoundedRect(smoothed)).toEqual({ x: 2, y: 2, width: 20, height: 20, r: 6, smoothing: 0.6 });
    expect(inkBounds([["path", { d: "M2 12a10 10 0 0 1 20 0" }]])).toEqual({ minX: 1, minY: 1, maxX: 23, maxY: 13 });
  });

  test("classifies grid alignment", () => {
    expect([gridClass(12), gridClass(11.5), gridClass(11.25)]).toEqual(["integer", "half", "other"]);
  });
});

// Corner radius r, width w, and height h rectangle drawn as Figma exports it after SVGO.
const roundedRect = (x, y, w, h, r) =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1-${r} ${r}h-${w - 2 * r}a${r} ${r} 0 0 1-${r}-${r}v-${h - 2 * r}a${r} ${r} 0 0 1 ${r}-${r}z`;

describe("corner smoothing", () => {
  test("draws Figma's 60% smoothed corner on the square keyline", () => {
    const smoothed = smoothCorners("M8 22h8a6 6 0 0 0 6-6V8a6 6 0 0 0-6-6H8a6 6 0 0 0-6 6v8a6 6 0 0 0 6 6");
    // Figma's construction for r 6 at 60%: the curve starts 9.6px from the
    // corner, with handles at a = 3.3603 and a + b = 5.0405, and meets the
    // 36° arc 0.6540px in from the edge.
    expect(smoothed.startsWith("M11.6 22L12.4 22C15.7603 22 17.4405 22 18.7239 21.346A6 6 0 0 0 21.346 18.7239")).toBe(true);
    expect(measureCorners(smoothed).map(({ r, smoothing }) => [r, Number(smoothing.toFixed(4))])).toEqual(
      Array(4).fill([6, 0.6]),
    );
  });

  test("is idempotent", () => {
    const once = smoothCorners(roundedRect(2, 4, 20, 16, 4));
    expect(once).not.toBe(roundedRect(2, 4, 20, 16, 4));
    expect(smoothCorners(once)).toBe(once);
    expect(findUnsmoothedCorners(once)).toEqual([]);
  });

  test("tightens the radius on edges of 8px or more to keep 60%", () => {
    const corners = measureCorners(smoothCorners(roundedRect(6, 6, 12, 12, 4)));
    expect(corners.map(({ r, smoothing }) => [r, Number(smoothing.toFixed(4))])).toEqual(Array(4).fill([3.75, 0.6]));
  });

  test("keeps the radius on shorter edges and smooths as much as fits", () => {
    const corners = measureCorners(smoothCorners(roundedRect(9, 9, 6, 6, 2)));
    expect(corners.map(({ r, smoothing }) => [r, Number(smoothing.toFixed(4))])).toEqual(Array(4).fill([2, 0.5]));
  });

  test("keeps the radius at corners sharper than 90° so their tip stays put", () => {
    const d = "m20.816 6.024-6.263 14.093a1.484 1.484 0 0 1-2.832-.438l-.479-4.307a2.96 2.96 0 0 0-2.614-2.614l-4.307-.479a1.484 1.484 0 0 1-.438-2.832l14.093-6.263a2.153 2.153 0 0 1 2.84 2.84";
    const smoothed = smoothCorners(d);
    expect(measureCorners(smoothed).length).toBe(4);
    const before = inkBounds([["path", { d }]]);
    const after = inkBounds([["path", { d: smoothed }]]);
    for (const key of ["minX", "minY"]) expect(after[key]).toBeGreaterThanOrEqual(before[key] - 1e-3);
    for (const key of ["maxX", "maxY"]) expect(after[key]).toBeLessThanOrEqual(before[key] + 1e-3);
  });

  test("sees the whole edge when a closed subpath starts partway along it", () => {
    const smoothed = smoothCorners("M15 2h1a6 6 0 0 1 6 6v8a6 6 0 0 1-6 6H8a6 6 0 0 1-6-6V8a6 6 0 0 1 6-6z");
    expect(measureCorners(smoothed).map(({ r, smoothing }) => [r, Number(smoothing.toFixed(4))])).toEqual(
      Array(4).fill([6, 0.6]),
    );
    expect(smoothCorners(smoothed)).toBe(smoothed);
  });

  test("keeps a stroke that ended on a corner attached to the smoothed curve", () => {
    // coffee: the handle's bottom line ends on the cup's r6 corner.
    const cup = "M3 10h14v5a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6z";
    const handle = "M17 12h1a3 3 0 0 1 0 6h-1.803";
    const [, attached] = reattachEnds([cup, handle], [smoothCorners(cup), handle]);
    const end = parsePath(attached)[0].segments.at(-1).to;
    expect(end[1]).toBe(18);
    expect(end[0]).toBeCloseTo(16.79, 2);
    const curve = sampleSubpath(parsePath(smoothCorners(cup))[0], 0.005);
    expect(Math.min(...curve.map(([x, y]) => Math.hypot(x - end[0], y - end[1])))).toBeLessThan(0.01);
  });

  test("leaves stroke ends alone when nothing they touch was smoothed", () => {
    const paths = ["M16 18.072q.027.252-.004.515", "M16 18.072v.208"];
    expect(reattachEnds(paths, paths)).toEqual(paths);
  });

  test("keeps dots drawn as tiny lines", () => {
    const smoothed = smoothCorners("M9 2h6a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4m3 15h.01");
    expect(smoothed.endsWith("M12 17L12.01 17")).toBe(true);
  });

  test("smooths corners of any angle", () => {
    const d = "M4 20L9.5 10.474A3 3 0 0 1 14.696 10.474L20 19.66";
    const [corner] = measureCorners(smoothCorners(d));
    expect(Number(((corner.turn * 180) / Math.PI).toFixed(1))).toBe(120);
    expect(Number(corner.smoothing.toFixed(4))).toBe(0.6);
  });

  test.each([
    ["a circle", "M2 12a10 10 0 0 1 20 0 10 10 0 0 1-20 0"],
    ["a pill with no straight run beside its arcs", "M8 10h8a2 2 0 0 1 0 4H8a2 2 0 0 1 0-4"],
    ["a gentle bend", "M7 20v-6a35 35 0 0 1 .117-1.66L8 8"],
    ["an arc at a free end", "M3 12h6a3 3 0 0 1 3 3"],
    ["an arc that does not meet its lines tangentially", "M2 2h8a4 4 0 0 1 4 4l6 6"],
  ])("leaves %s unchanged", (_name, d) => {
    expect(smoothCorners(d)).toBe(d);
  });

  test("rejects plain rounded corners and normalization fixes them", () => {
    const plain = validSvg.replace("M4 12h16", roundedRect(2, 2, 20, 20, 6));
    expect(() => validateSvgContent(plain, "plain-corners.svg")).toThrow(
      "plain-corners.svg: 4 rounded corner(s) use a plain circular arc",
    );
    const normalized = normalizeSvg(plain, "plain-corners.svg");
    expect(() => validateSvgContent(normalized, "plain-corners.svg")).not.toThrow();
    expect(normalizeSvg(normalized, "plain-corners.svg")).toBe(normalized);
  });

  test("rejects rect elements with rounded corners", () => {
    const rect = validSvg.replace('<path d="M4 12h16"/>', '<rect x="2" y="2" width="20" height="20" rx="6"/>');
    expect(() => validateSvgContent(rect, "rect.svg")).toThrow("cannot carry corner smoothing");
  });

  test("never moves ink outward", () => {
    for (const d of [roundedRect(2, 2, 20, 20, 6), roundedRect(5, 2, 14, 20, 4), roundedRect(2, 2, 8, 8, 3)]) {
      const before = inkBounds([["path", { d }]]);
      const after = inkBounds([["path", { d: smoothCorners(d) }]]);
      expect(after.minX).toBeGreaterThanOrEqual(before.minX - 1e-9);
      expect(after.maxY).toBeLessThanOrEqual(before.maxY + 1e-9);
    }
  });
});

describe("OG icon selection", () => {
  test("shuffles every icon without repeating any", () => {
    const icons = ["one", "two", "three", "four"];
    const shuffled = shuffleUnique(icons, () => 0.25);

    expect(shuffled).not.toBe(icons);
    expect(shuffled).toHaveLength(icons.length);
    expect(new Set(shuffled)).toEqual(new Set(icons));
  });
});

describe("path cleanup", () => {
  test("joins strokes that meet into one, preferring the straight continuation", () => {
    // A T-junction: the bar continues straight through and the stem stays separate.
    const { paths, joins } = cleanPaths(["M4 6h8M12 6h8M12 6v12"]);
    expect(joins).toBe(1);
    expect(paths).toEqual(["M4 6L20 6M12 6L12 18"]);
  });

  test("reverses a stroke to join it end to end", () => {
    const { paths } = cleanPaths(["M4 4h8M20 4h-8"]);
    expect(paths).toEqual(["M4 4L20 4"]);
    const { paths: curved } = cleanPaths(["M4 12h4M12 8a4 4 0 0 0-4 4"]);
    expect(curved).toEqual(["M4 12L8 12A4 4 0 0 1 12 8"]);
  });

  test("joins a loop drawn in pieces and leaves it open where it meets", () => {
    const { paths } = cleanPaths(["M4 4h16M20 4v16M20 20H4M4 20V4"]);
    expect(paths).toEqual(["M4 4L20 4L20 20L4 20L4 4"]);
  });

  test("removes lone movetos and stubs hidden under another stroke", () => {
    const { paths, debris } = cleanPaths(["M2 9h20M21.916 9h.001M7 7M2 9z"]);
    expect(debris).toBe(3);
    expect(paths).toEqual(["M2 9L22 9"]);
  });

  test("keeps dots drawn as tiny lines", () => {
    const d = "M4 12h10M18 12h.01";
    expect(cleanPaths([d])).toEqual({ paths: [d], debris: 0, joins: 0, merges: 0, snaps: 0 });
  });

  test("snaps lines just off the whole-pixel grid and what meets them", () => {
    const { paths, snaps } = cleanPaths(["M5.937 4v16M3 5.937h16"]);
    expect(snaps).toBe(2);
    expect(paths).toEqual(["M6 4L6 20M3 6L19 6"]);
  });

  test.each([
    ["half-pixel lines", "M4 4.5h16"],
    ["short ticks", "M4 4.95v.5"],
    ["lines 0.1px or more off the grid", "M4 4.9h16"],
  ])("leaves %s where they are", (_name, d) => {
    expect(cleanPaths([d]).snaps).toBe(0);
  });

  test("rejects unclean path data and normalization cleans it", () => {
    const split = validSvg.replace("M4 12h16", "M4 12h8m0 0h8M7.95 6v12");
    expect(() => validateSvgContent(split, "split.svg")).toThrow(
      "split.svg: 1 stroke(s) split where they meet, 1 straight line(s) split in pieces, 1 line(s) less than 0.1px off the whole-pixel grid; run bun run icons:optimize",
    );
    const normalized = normalizeSvg(split, "split.svg");
    expect(normalized).toContain('<path d="M4 12h16M8 6v12"/>');
    expect(() => validateSvgContent(normalized, "split.svg")).not.toThrow();
    expect(normalizeSvg(normalized, "split.svg")).toBe(normalized);
  });
});
