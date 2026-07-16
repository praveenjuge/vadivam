export const publishablePackages = [
  {
    name: "vadivam",
    directory: "packages/vadivam",
    description: "Pixel-perfect 24px outline SVG icons with tree-shakeable ESM imports and metadata.",
    keywords: ["javascript"],
  },
  {
    name: "vadivam-react",
    directory: "packages/vadivam-react",
    description: "Pixel-perfect 24px outline icon components for React with tree-shakeable imports.",
    keywords: ["react", "react-icons"],
  },
  {
    name: "vadivam-react-native",
    directory: "packages/vadivam-react-native",
    description: "Pixel-perfect 24px outline icons for React Native and Expo, powered by react-native-svg.",
    keywords: ["react-native", "react-native-svg", "expo"],
  },
  {
    name: "vadivam-vue",
    directory: "packages/vadivam-vue",
    description: "Pixel-perfect 24px outline icon components for Vue with tree-shakeable imports.",
    keywords: ["vue", "vue-icons"],
  },
  {
    name: "vadivam-svelte",
    directory: "packages/vadivam-svelte",
    description: "Pixel-perfect 24px outline icon components for Svelte with tree-shakeable imports.",
    keywords: ["svelte", "svelte-icons"],
  },
  {
    name: "vadivam-solid",
    directory: "packages/vadivam-solid",
    description: "Pixel-perfect 24px outline icon components for Solid with tree-shakeable imports.",
    keywords: ["solid", "solidjs", "solid-icons"],
  },
  {
    name: "vadivam-angular",
    directory: "packages/vadivam-angular",
    description: "Pixel-perfect 24px outline icon directives for Angular with tree-shakeable imports.",
    keywords: ["angular", "angular-icons"],
  },
  {
    name: "vadivam-astro",
    directory: "packages/vadivam-astro",
    description: "Pixel-perfect 24px outline icon components for Astro with tree-shakeable imports.",
    keywords: ["astro", "astro-icons", "astro-components"],
  },
  {
    name: "vadivam-preact",
    directory: "packages/vadivam-preact",
    description: "Pixel-perfect 24px outline icon components for Preact with tree-shakeable imports.",
    keywords: ["preact", "preact-icons"],
  },
];

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
