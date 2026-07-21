import { defineConfig } from "blume";

export default defineConfig({
  title: "Vadivam Icons",
  description: "Open-source 24px outline icons for SVG and modern frameworks.",
  basePath: "/docs",
  lastModified: true,
  logo: {
    image: "/logo.svg",
    text: "",
  },
  navigation: {
    tabs: [{ label: "Documentation", path: "/docs" }],
  },
  github: {
    owner: "praveenjuge",
    repo: "vadivam",
    dir: "apps/docs",
  },
  seo: {
    x: { creator: "@praveenjuge", handle: "@praveenjuge" },
  },
  deployment: {
    output: "static",
    site: "https://vadivam.praveenjuge.com",
  },
});
