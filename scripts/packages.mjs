// Every package Vadivam publishes, in the order the docs list frameworks. The
// build generates each one (scripts/generators/index.mjs maps ids to
// generators), the release scripts version and publish it, and the docs site
// and MCP server use it to show how to install and import it. Browser-safe: no
// imports.
//
// `title` is the product's full name where the short `label` drops a word.
// `dynamicIcon` says how the package renders an icon from a runtime name: a
// `DynamicIcon` component from its `/dynamic` entry, as a named or default
// export (Angular's is a directive), or a `lookup` described in words.
// `lucide` names the Lucide packages the migrate-lucide codemod renames to
// this one, and `lucideManual` the ones it leaves for a hand migration, with
// the reason it prints. `releaseName` is the release notes' name for a package
// whose `packageName` another registry also has.

const npm = (target) => ({ registry: "npm", ...target });

const published = [
  npm({
    id: "core",
    lucide: ["lucide"],
    lucideManual: { "lucide-static": "use vadivam/icons/<name>.svg, vadivam/strings/<name>, the sprite, or the font" },
    label: "SVG and JavaScript",
    packageName: "vadivam",
    directory: "packages/vadivam",
    dynamicIcon: { lookup: 'No DynamicIcon in vadivam; validate names with iconNames from "vadivam/manifest", or render <vadivam-icon name="…"> from "vadivam/elements".' },
    description: "Pixel-perfect 24px outline and solid SVG icons with tree-shakeable ESM imports and metadata.",
    keywords: ["javascript"],
    readmeSearchPhrase: "Tree-shakeable 24px outline and solid SVG icons for JavaScript",
  }),
  npm({
    id: "react",
    lucide: ["lucide-react"],
    label: "React",
    lang: "tsx",
    framework: true,
    packageName: "vadivam-react",
    directory: "packages/vadivam-react",
    dynamicIcon: { export: "named" },
    description: "Pixel-perfect 24px outline and solid icon components for React with tree-shakeable imports.",
    keywords: ["react", "react-icons"],
    readmeSearchPhrase: "Tree-shakeable 24px outline and solid SVG icons for React",
  }),
  npm({
    id: "react-native",
    lucide: ["lucide-react-native"],
    label: "React Native",
    lang: "tsx",
    framework: true,
    packageName: "vadivam-react-native",
    peers: ["react-native-svg"],
    directory: "packages/vadivam-react-native",
    dynamicIcon: { export: "named" },
    description: "Pixel-perfect 24px outline and solid icons for React Native and Expo, powered by react-native-svg.",
    keywords: ["react-native", "react-native-svg", "expo"],
    readmeSearchPhrase: "Tree-shakeable 24px outline and solid icons for React Native and Expo",
  }),
  npm({
    id: "vue",
    lucide: ["lucide-vue-next", "@lucide/vue"],
    lucideManual: { "lucide-vue": "Vue 2 is not supported; vadivam-vue targets Vue 3" },
    label: "Vue",
    lang: "vue",
    framework: true,
    packageName: "vadivam-vue",
    directory: "packages/vadivam-vue",
    dynamicIcon: { export: "named" },
    description: "Pixel-perfect 24px outline and solid icon components for Vue with tree-shakeable imports.",
    keywords: ["vue", "vue-icons"],
    readmeSearchPhrase: "Tree-shakeable 24px outline and solid SVG icons for Vue",
  }),
  npm({
    id: "svelte",
    lucide: ["lucide-svelte", "@lucide/svelte"],
    label: "Svelte",
    lang: "svelte",
    framework: true,
    packageName: "vadivam-svelte",
    directory: "packages/vadivam-svelte",
    dynamicIcon: { export: "default" },
    description: "Pixel-perfect 24px outline and solid icon components for Svelte with tree-shakeable imports.",
    keywords: ["svelte", "svelte-icons"],
    readmeSearchPhrase: "Tree-shakeable 24px outline and solid SVG icons for Svelte",
  }),
  npm({
    id: "solid",
    lucide: ["lucide-solid"],
    label: "Solid",
    lang: "tsx",
    framework: true,
    packageName: "vadivam-solid",
    directory: "packages/vadivam-solid",
    dynamicIcon: { export: "named" },
    description: "Pixel-perfect 24px outline and solid icon components for Solid with tree-shakeable imports.",
    keywords: ["solid", "solidjs", "solid-icons"],
    readmeSearchPhrase: "Tree-shakeable 24px outline and solid SVG icons for Solid",
  }),
  npm({
    id: "preact",
    lucide: ["lucide-preact"],
    label: "Preact",
    lang: "tsx",
    framework: true,
    packageName: "vadivam-preact",
    directory: "packages/vadivam-preact",
    dynamicIcon: { export: "named" },
    description: "Pixel-perfect 24px outline and solid icon components for Preact with tree-shakeable imports.",
    keywords: ["preact", "preact-icons"],
    readmeSearchPhrase: "Tree-shakeable 24px outline and solid SVG icons for Preact",
  }),
  npm({
    id: "astro",
    lucide: ["@lucide/astro"],
    label: "Astro",
    lang: "astro",
    framework: true,
    packageName: "vadivam-astro",
    directory: "packages/vadivam-astro",
    dynamicIcon: { export: "default" },
    description: "Pixel-perfect 24px outline and solid icon components for Astro with tree-shakeable imports.",
    keywords: ["astro", "astro-icons", "astro-components"],
    readmeSearchPhrase: "Tree-shakeable 24px outline and solid SVG icons for Astro",
  }),
  npm({
    id: "angular",
    lucideManual: {
      "lucide-angular": "vadivam-angular uses one standalone directive per icon",
      "@lucide/angular": "vadivam-angular uses one standalone directive per icon",
    },
    label: "Angular",
    lang: "ts",
    framework: true,
    packageName: "vadivam-angular",
    directory: "packages/vadivam-angular",
    dynamicIcon: { export: "named", directive: "vadivamDynamicIcon" },
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
    dynamicIcon: { lookup: 'No DynamicIcon in vadivam-qwik; look icons up in the `icons` registry from "vadivam-qwik" after validating the name.' },
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
    dynamicIcon: { export: "named" },
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
    dynamicIcon: { lookup: "VadivamIcons.all[name] returns the icon data or null. Referencing it keeps every icon in the build." },
    releaseName: "vadivam for Flutter",
    versionFile: "packages/vadivam-flutter/pubspec.yaml",
    versionPattern: /^version: (.+)$/m,
    versionLine: (version) => `version: ${version}`,
  },
  {
    id: "compose",
    label: "Compose",
    title: "Jetpack Compose",
    lang: "kotlin",
    framework: true,
    packageName: "com.praveenjuge:vadivam-compose",
    registry: "maven",
    directory: "packages/vadivam-compose",
    dynamicIcon: { lookup: "VadivamIcons.byName(name) returns the ImageVector or null. Calling it keeps every icon in the app." },
    versionFile: "packages/vadivam-compose/gradle.properties",
    versionPattern: /^VERSION_NAME=(.+)$/m,
    versionLine: (version) => `VERSION_NAME=${version}`,
  },
  npm({
    id: "mcp",
    label: "MCP server",
    packageName: "vadivam-mcp",
    directory: "packages/vadivam-mcp",
    description: "MCP server for AI agents to search Vadivam's 24px outline and solid icons and get SVG or framework code.",
    keywords: ["mcp", "mcp-server", "model-context-protocol", "ai-agents"],
    readmeSearchPhrase: "An MCP server for searching 24px outline and solid icons",
  }),
];

/** Each package with the path of its docs page, `/docs/<id>`. */
export const targets = Object.freeze(published.map((target) => ({ ...target, documentation: `/docs/${target.id}` })));

export const registryNames = Object.freeze({ npm: "npm", pub: "pub.dev", maven: "Maven Central" });

const registryPages = {
  npm: (packageName) => `https://www.npmjs.com/package/${packageName}`,
  pub: (packageName) => `https://pub.dev/packages/${packageName}`,
  maven: (packageName) => `https://central.sonatype.com/artifact/${packageName.replace(":", "/")}`,
};

/** A package's page on its registry. */
export function registryUrl({ registry, packageName }) {
  return registryPages[registry](packageName);
}

/** A package as the release notes link it: its name on its registry page. */
export function releaseLink(target) {
  return `[${target.releaseName ?? target.packageName.split(":").pop()}](${registryUrl(target)})`;
}

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
