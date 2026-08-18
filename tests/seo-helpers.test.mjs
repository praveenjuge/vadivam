import { describe, expect, test } from "bun:test";
import {
  completeSitemap,
  googleSiteVerificationFile,
  sitemapDay,
} from "../scripts/complete-sitemap.mjs";
import {
  INDEXNOW_KEY,
  indexNowKeyFileName,
  indexNowPayload,
  sitemapLocations,
  submitIndexNow,
} from "../scripts/indexnow.mjs";
import { relatedIcons } from "../apps/docs/lib/icon-seo.ts";

describe("icon related links", () => {
  test("prefers shared prefixes and fills from neighbors", () => {
    const icons = [
      { name: "activity", componentName: "Activity", fileName: "activity.svg" },
      { name: "arrow-down", componentName: "ArrowDown", fileName: "arrow-down.svg" },
      { name: "arrow-left", componentName: "ArrowLeft", fileName: "arrow-left.svg" },
      { name: "arrow-right", componentName: "ArrowRight", fileName: "arrow-right.svg" },
      { name: "bell", componentName: "Bell", fileName: "bell.svg" },
    ];
    const related = relatedIcons(icons[3], icons, 3);
    expect(related.map(({ name }) => name)).toEqual(["arrow-down", "arrow-left", "bell"]);
  });
});

describe("sitemap completion", () => {
  test("adds icon routes with lastmod dates", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://vadivam.praveenjuge.com/</loc><lastmod>2026-08-01</lastmod></url>
</urlset>
`;
    const output = completeSitemap(xml, ["activity"], { activity: "2026-08-18" });
    expect(output).toContain("<lastmod>2026-08-18</lastmod>");
    expect(output).toContain("<loc>https://vadivam.praveenjuge.com/icons/activity</loc>");
    expect(sitemapDay("2026-08-18T15:04:05.000Z")).toBe("2026-08-18");
  });

  test("writes a Google Search Console HTML verification file", () => {
    expect(googleSiteVerificationFile()).toBeNull();
    expect(googleSiteVerificationFile("abc_12-Z")).toEqual({
      fileName: "googleabc_12-Z.html",
      contents: "google-site-verification: abc_12-Z\n",
    });
    expect(() => googleSiteVerificationFile("nope.html")).toThrow();
  });
});

describe("IndexNow", () => {
  test("builds a host payload from the sitemap", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://vadivam.praveenjuge.com/</loc></url>
  <url><loc>https://vadivam.praveenjuge.com/icons/activity</loc></url>
</urlset>
`;
    const urls = sitemapLocations(xml);
    expect(indexNowKeyFileName()).toBe(`${INDEXNOW_KEY}.txt`);
    expect(indexNowPayload(urls)).toEqual({
      host: "vadivam.praveenjuge.com",
      key: INDEXNOW_KEY,
      keyLocation: `https://vadivam.praveenjuge.com/${INDEXNOW_KEY}.txt`,
      urlList: urls,
    });
  });

  test("posts the sitemap URLs", async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, text: async () => "" };
    };
    await submitIndexNow(["https://vadivam.praveenjuge.com/"], { fetchImpl });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.indexnow.org/indexnow");
    expect(JSON.parse(calls[0].init.body).urlList).toEqual(["https://vadivam.praveenjuge.com/"]);
  });
});
