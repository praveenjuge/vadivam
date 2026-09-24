import { defineConfig } from "blume";
import { cloudflare } from "blume/analytics";
import { cloudflare as cloudflareDeployment } from "blume/deploy";
import { filesystem, githubReleases } from "blume/sources";

export default defineConfig({
  title: "Vadivam Icons",
  description:
    "Browse pixel-perfect, open-source 24px outline icons for SVG, React, React Native, Vue, Svelte, Solid, Angular, Astro, and Preact.",
  analytics: [cloudflare({ token: "aab722c0300445d9b5c73b06de1a4fc6" })],
  content: {
    sources: [
      filesystem({ root: "docs", prefix: "docs" }),
      githubReleases({
        prefix: "changelog",
        owner: "praveenjuge",
        repo: "vadivam",
      }),
    ],
  },
  lastModified: "git",
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
  search: {
    popular: [
      { href: "/docs/installation", label: "Installation", icon: "download" },
      { href: "/docs/usage", label: "Usage & styling", icon: "palette" },
      { href: "/docs/dynamic-icons", label: "Dynamic icons", icon: "shuffle" },
      { href: "/docs/react", label: "React", icon: "code" },
      { href: "/docs/core", label: "Core SVG", icon: "file-code" },
      {
        href: "/docs/contributing",
        label: "Contributing",
        icon: "git-pull-request",
      },
    ],
  },
  agents: {
    contentSignals: {
      search: true,
      aiInput: true,
      aiTrain: true,
    },
  },
  seo: {
    og: {
      titles: {
        "/": "Vadivam — 24px Outline Icons",
      },
    },
    x: { creator: "@praveenjuge", handle: "@praveenjuge" },
  },
  deployment: cloudflareDeployment({
    site: "https://vadivam.praveenjuge.com",
  }),
  markdown: {
    externalLinks: true,
  },
  theme: {
    fonts: {
      display: { name: "SN Pro", weights: [400, 500, 600, 700] },
      body: { name: "SN Pro", weights: [400, 500, 600, 700] },
    },
  },
});
