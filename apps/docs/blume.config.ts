import { defineConfig } from "blume";

export default defineConfig({
  title: "Vadivam Icons",
  description:
    "Browse pixel-perfect, open-source 24px outline icons for SVG, React, React Native, Vue, Svelte, Solid, Angular, Astro, and Preact.",
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
    contentSignals: {
      search: true,
      aiInput: true,
      aiTrain: true,
    },
    og: {
      titles: {
        "/": "Vadivam — 24px Outline Icons",
      },
    },
    x: { creator: "@praveenjuge", handle: "@praveenjuge" },
  },
  deployment: {
    output: "static",
    site: "https://vadivam.praveenjuge.com",
  },
});
