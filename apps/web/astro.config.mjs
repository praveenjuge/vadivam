import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://vadivam.praveenjuge.com",
  integrations: [
    sitemap({
      changefreq: "weekly",
      priority: 0.7,
      lastmod: new Date(),
      serialize(item) {
        if (item.url === "https://vadivam.praveenjuge.com/") {
          item.priority = 1.0;
          item.changefreq = "daily";
        }
        return item;
      },
    }),
  ],
});
