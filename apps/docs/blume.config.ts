import { defineConfig } from "blume";

export default defineConfig({
  title: "Vadivam Icons",
  description:
    "Browse pixel-perfect, open-source 24px outline icons for SVG, React, React Native, Vue, Svelte, Solid, Angular, Astro, and Preact.",
  content: {
    sources: [
      { type: "filesystem", root: "docs", prefix: "docs" },
      {
        type: "github-releases",
        prefix: "changelog",
        owner: "praveenjuge",
        repo: "vadivam",
      },
    ],
  },
  lastModified: true,
  i18n: {
    defaultLocale: "en",
    locales: [{ code: "en", label: "English" }],
    ui: {
      en: {
        changelog: {
          description:
            "Read every Vadivam release with version-specific icon additions, package updates, documentation improvements, and tooling changes.",
        },
      },
    },
  },
  logo: {
    image: "/logo.svg",
    text: "",
  },
  navigation: {
    tabs: [
      { label: "Documentation", path: "/docs" },
      { label: "Changelog", path: "/changelog", href: "/changelog" },
    ],
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
