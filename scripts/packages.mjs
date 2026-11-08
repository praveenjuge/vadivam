// Every package Vadivam publishes, in the order the docs list frameworks. The
// build generates each one (scripts/icons.mjs maps ids to generators), the
// release scripts version and publish it, and the docs site and MCP server use
// it to show how to install and import it. Browser-safe: no imports.

const npm = (target) => ({ registry: "npm", ...target });

export const targets = Object.freeze([
  npm({
    id: "core",
    label: "SVG and JavaScript",
    packageName: "vadivam",
    directory: "packages/vadivam",
    documentation: "/docs/core",
    description: "Pixel-perfect 24px outline and solid SVG icons with tree-shakeable ESM imports and metadata.",
    keywords: ["javascript"],
    readmeSearchPhrase: "Tree-shakeable 24px outline and solid SVG icons for JavaScript",
  }),
  npm({
    id: "react",
    label: "React",
    lang: "tsx",
    framework: true,
    packageName: "vadivam-react",
    directory: "packages/vadivam-react",
    documentation: "/docs/react",
    description: "Pixel-perfect 24px outline and solid icon components for React with tree-shakeable imports.",
    keywords: ["react", "react-icons"],
    readmeSearchPhrase: "Tree-shakeable 24px outline and solid SVG icons for React",
  }),
  npm({
    id: "react-native",
    label: "React Native",
    lang: "tsx",
    framework: true,
    packageName: "vadivam-react-native",
    peers: ["react-native-svg"],
    directory: "packages/vadivam-react-native",
    documentation: "/docs/react-native",
    description: "Pixel-perfect 24px outline and solid icons for React Native and Expo, powered by react-native-svg.",
    keywords: ["react-native", "react-native-svg", "expo"],
    readmeSearchPhrase: "Tree-shakeable 24px outline and solid icons for React Native and Expo",
  }),
  npm({
    id: "vue",
    label: "Vue",
    lang: "vue",
    framework: true,
    packageName: "vadivam-vue",
    directory: "packages/vadivam-vue",
    documentation: "/docs/vue",
    description: "Pixel-perfect 24px outline and solid icon components for Vue with tree-shakeable imports.",
    keywords: ["vue", "vue-icons"],
    readmeSearchPhrase: "Tree-shakeable 24px outline and solid SVG icons for Vue",
  }),
  npm({
    id: "svelte",
    label: "Svelte",
    lang: "svelte",
    framework: true,
    packageName: "vadivam-svelte",
    directory: "packages/vadivam-svelte",
    documentation: "/docs/svelte",
    description: "Pixel-perfect 24px outline and solid icon components for Svelte with tree-shakeable imports.",
    keywords: ["svelte", "svelte-icons"],
    readmeSearchPhrase: "Tree-shakeable 24px outline and solid SVG icons for Svelte",
  }),
  npm({
    id: "solid",
    label: "Solid",
    lang: "tsx",
    framework: true,
    packageName: "vadivam-solid",
    directory: "packages/vadivam-solid",
    documentation: "/docs/solid",
    description: "Pixel-perfect 24px outline and solid icon components for Solid with tree-shakeable imports.",
    keywords: ["solid", "solidjs", "solid-icons"],
    readmeSearchPhrase: "Tree-shakeable 24px outline and solid SVG icons for Solid",
  }),
  npm({
    id: "preact",
    label: "Preact",
    lang: "tsx",
    framework: true,
    packageName: "vadivam-preact",
    directory: "packages/vadivam-preact",
    documentation: "/docs/preact",
    description: "Pixel-perfect 24px outline and solid icon components for Preact with tree-shakeable imports.",
    keywords: ["preact", "preact-icons"],
    readmeSearchPhrase: "Tree-shakeable 24px outline and solid SVG icons for Preact",
  }),
  npm({
    id: "astro",
    label: "Astro",
    lang: "astro",
    framework: true,
    packageName: "vadivam-astro",
    directory: "packages/vadivam-astro",
    documentation: "/docs/astro",
    description: "Pixel-perfect 24px outline and solid icon components for Astro with tree-shakeable imports.",
    keywords: ["astro", "astro-icons", "astro-components"],
    readmeSearchPhrase: "Tree-shakeable 24px outline and solid SVG icons for Astro",
  }),
  npm({
    id: "angular",
    label: "Angular",
    lang: "ts",
    framework: true,
    packageName: "vadivam-angular",
    directory: "packages/vadivam-angular",
    documentation: "/docs/angular",
    description: "Pixel-perfect 24px outline and solid icon directives for Angular with tree-shakeable imports.",
    keywords: ["angular", "angular-icons"],
    readmeSearchPhrase: "Tree-shakeable 24px outline and solid SVG icon directives for Angular",
  }),
  npm({
    id: "qwik",
    label: "Qwik",
    lang: "tsx",
    framework: true,
    packageName: "vadivam-qwik",
    directory: "packages/vadivam-qwik",
    documentation: "/docs/qwik",
    description: "Pixel-perfect 24px outline and solid icon components for Qwik with tree-shakeable imports.",
    keywords: ["qwik", "qwik-icons"],
    readmeSearchPhrase: "Tree-shakeable 24px outline and solid SVG icons for Qwik",
  }),
  npm({
    id: "lit",
    label: "Lit",
    lang: "ts",
    framework: true,
    packageName: "vadivam-lit",
    directory: "packages/vadivam-lit",
    documentation: "/docs/lit",
    description: "Pixel-perfect 24px outline and solid icon templates for Lit with tree-shakeable imports.",
    keywords: ["lit", "lit-html", "web-components"],
    readmeSearchPhrase: "Tree-shakeable 24px outline and solid SVG icons for Lit",
  }),
  {
    id: "flutter",
    label: "Flutter",
    lang: "dart",
    framework: true,
    packageName: "vadivam",
    registry: "pub",
    directory: "packages/vadivam-flutter",
    documentation: "/docs/flutter",
    releaseLink: "[vadivam for Flutter](https://pub.dev/packages/vadivam)",
    versionFile: "packages/vadivam-flutter/pubspec.yaml",
    versionPattern: /^version: (.+)$/m,
    versionLine: (version) => `version: ${version}`,
  },
  {
    id: "compose",
    label: "Compose",
    lang: "kotlin",
    framework: true,
    packageName: "com.praveenjuge:vadivam-compose",
    registry: "maven",
    directory: "packages/vadivam-compose",
    documentation: "/docs/compose",
    releaseLink: "[vadivam-compose](https://central.sonatype.com/artifact/com.praveenjuge/vadivam-compose)",
    versionFile: "packages/vadivam-compose/gradle.properties",
    versionPattern: /^VERSION_NAME=(.+)$/m,
    versionLine: (version) => `VERSION_NAME=${version}`,
  },
  npm({
    id: "mcp",
    label: "MCP server",
    packageName: "vadivam-mcp",
    directory: "packages/vadivam-mcp",
    documentation: "/docs/mcp",
    description: "MCP server for AI agents to search Vadivam's 24px outline and solid icons and get SVG or framework code.",
    keywords: ["mcp", "mcp-server", "model-context-protocol", "ai-agents"],
    readmeSearchPhrase: "An MCP server for searching 24px outline and solid icons",
  }),
]);

export const targetsById = Object.freeze(Object.fromEntries(targets.map((target) => [target.id, target])));

/** Packages published to npm through Trusted Publishing. */
export const npmPackages = targets.filter((target) => target.registry === "npm");

/** Packages published outside npm, each with its version on one line of a file. */
export const nativePackages = targets.filter((target) => target.registry !== "npm");

/** The packages that render icons in an app framework. */
export const frameworks = targets.filter((target) => target.framework);

export const siteUrl = "https://vadivam.praveenjuge.com";
export const repositoryUrl = "https://github.com/praveenjuge/vadivam";

// MCP Registry metadata published from the MCP server package's directory.
export const mcpServerManifest = "packages/vadivam-mcp/server.json";

/** Every package.json that carries the release version. */
export const releaseManifests = [
  "package.json",
  ...npmPackages.map(({ directory }) => `${directory}/package.json`),
  "apps/figma-plugin/package.json",
];

export const packageMetadata = {
  author: "Praveen Juge",
  bugs: { url: `${repositoryUrl}/issues` },
  homepage: siteUrl,
  license: "MIT",
  repositoryUrl: `git+${repositoryUrl}.git`,
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
