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
    sidebar: [
      "index",
      {
        label: "Get started",
        items: ["installation", "usage", "core", "dynamic-icons"],
      },
      {
        label: "Frameworks",
        items: [
          "react",
          "react-native",
          "vue",
          "svelte",
          "solid",
          "angular",
          "astro",
          "preact",
        ],
      },
      {
        label: "Advanced",
        items: ["contributing"],
      },
    ],
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
