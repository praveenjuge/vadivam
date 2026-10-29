export const publishablePackages = [
  {
    name: "vadivam",
    directory: "packages/vadivam",
    description: "Pixel-perfect 24px outline and solid SVG icons with tree-shakeable ESM imports and metadata.",
    documentation: "/docs/core",
    keywords: ["javascript"],
    readmeSearchPhrase: "Tree-shakeable 24px outline and solid SVG icons for JavaScript",
  },
  {
    name: "vadivam-react",
    directory: "packages/vadivam-react",
    description: "Pixel-perfect 24px outline and solid icon components for React with tree-shakeable imports.",
    documentation: "/docs/react",
    keywords: ["react", "react-icons"],
    readmeSearchPhrase: "Tree-shakeable 24px outline and solid SVG icons for React",
  },
  {
    name: "vadivam-react-native",
    directory: "packages/vadivam-react-native",
    description: "Pixel-perfect 24px outline and solid icons for React Native and Expo, powered by react-native-svg.",
    documentation: "/docs/react-native",
    keywords: ["react-native", "react-native-svg", "expo"],
    readmeSearchPhrase: "Tree-shakeable 24px outline and solid icons for React Native and Expo",
  },
  {
    name: "vadivam-vue",
    directory: "packages/vadivam-vue",
    description: "Pixel-perfect 24px outline and solid icon components for Vue with tree-shakeable imports.",
    documentation: "/docs/vue",
    keywords: ["vue", "vue-icons"],
    readmeSearchPhrase: "Tree-shakeable 24px outline and solid SVG icons for Vue",
  },
  {
    name: "vadivam-svelte",
    directory: "packages/vadivam-svelte",
    description: "Pixel-perfect 24px outline and solid icon components for Svelte with tree-shakeable imports.",
    documentation: "/docs/svelte",
    keywords: ["svelte", "svelte-icons"],
    readmeSearchPhrase: "Tree-shakeable 24px outline and solid SVG icons for Svelte",
  },
  {
    name: "vadivam-solid",
    directory: "packages/vadivam-solid",
    description: "Pixel-perfect 24px outline and solid icon components for Solid with tree-shakeable imports.",
    documentation: "/docs/solid",
    keywords: ["solid", "solidjs", "solid-icons"],
    readmeSearchPhrase: "Tree-shakeable 24px outline and solid SVG icons for Solid",
  },
  {
    name: "vadivam-angular",
    directory: "packages/vadivam-angular",
    description: "Pixel-perfect 24px outline and solid icon directives for Angular with tree-shakeable imports.",
    documentation: "/docs/angular",
    keywords: ["angular", "angular-icons"],
    readmeSearchPhrase: "Tree-shakeable 24px outline and solid SVG icon directives for Angular",
  },
  {
    name: "vadivam-astro",
    directory: "packages/vadivam-astro",
    description: "Pixel-perfect 24px outline and solid icon components for Astro with tree-shakeable imports.",
    documentation: "/docs/astro",
    keywords: ["astro", "astro-icons", "astro-components"],
    readmeSearchPhrase: "Tree-shakeable 24px outline and solid SVG icons for Astro",
  },
  {
    name: "vadivam-preact",
    directory: "packages/vadivam-preact",
    description: "Pixel-perfect 24px outline and solid icon components for Preact with tree-shakeable imports.",
    documentation: "/docs/preact",
    keywords: ["preact", "preact-icons"],
    readmeSearchPhrase: "Tree-shakeable 24px outline and solid SVG icons for Preact",
  },
  {
    name: "vadivam-lit",
    directory: "packages/vadivam-lit",
    description: "Pixel-perfect 24px outline icon templates for Lit with tree-shakeable imports.",
    documentation: "/docs/lit",
    keywords: ["lit", "lit-html", "web-components"],
    readmeSearchPhrase: "Tree-shakeable 24px outline SVG icons for Lit",
  },
  {
    name: "vadivam-qwik",
    directory: "packages/vadivam-qwik",
    description: "Pixel-perfect 24px outline icon components for Qwik with tree-shakeable imports.",
    documentation: "/docs/qwik",
    keywords: ["qwik", "qwik-icons"],
    readmeSearchPhrase: "Tree-shakeable 24px outline SVG icons for Qwik",
  },
  {
    name: "vadivam-mcp",
    directory: "packages/vadivam-mcp",
    description: "MCP server for AI agents to search Vadivam's 24px outline and solid icons and get SVG or framework code.",
    documentation: "/docs/mcp",
    keywords: ["mcp", "mcp-server", "model-context-protocol", "ai-agents"],
    readmeSearchPhrase: "An MCP server for searching 24px outline and solid icons",
  },
];

// Packages published outside npm. Each file holds the release version on one
// line, which bump-version.mjs rewrites and validate-versions.mjs checks.
export const nativePackages = [
  {
    name: "vadivam (pub.dev)",
    directory: "packages/vadivam-flutter",
    releaseLink: "[vadivam for Flutter](https://pub.dev/packages/vadivam)",
    versionFile: "packages/vadivam-flutter/pubspec.yaml",
    versionPattern: /^version: (.+)$/m,
    versionLine: (version) => `version: ${version}`,
  },
  {
    name: "com.praveenjuge:vadivam-compose",
    directory: "packages/vadivam-compose",
    releaseLink: "[vadivam-compose](https://central.sonatype.com/artifact/com.praveenjuge/vadivam-compose)",
    versionFile: "packages/vadivam-compose/gradle.properties",
    versionPattern: /^VERSION_NAME=(.+)$/m,
    versionLine: (version) => `VERSION_NAME=${version}`,
  },
];

// MCP Registry metadata published from the MCP server package's directory.
export const mcpServerManifest = "packages/vadivam-mcp/server.json";

export const packageMetadata = {
  author: "Praveen Juge",
  bugs: { url: "https://github.com/praveenjuge/vadivam/issues" },
  homepage: "https://vadivam.praveenjuge.com",
  license: "MIT",
  repositoryUrl: "git+https://github.com/praveenjuge/vadivam.git",
  sharedKeywords: [
    "icons",
    "svg",
    "outline-icons",
    "icon-library",
    "icon-pack",
    "24px",
    "tree-shakeable",
    "open-source",
    "vadivam",
  ],
};

export const packageDirectories = publishablePackages.map(
  ({ directory }) => directory,
);
