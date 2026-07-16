export const publishablePackages = [
  { name: "vadivam", directory: "packages/vadivam" },
  { name: "vadivam-react", directory: "packages/vadivam-react" },
  { name: "vadivam-react-native", directory: "packages/vadivam-react-native" },
  { name: "vadivam-vue", directory: "packages/vadivam-vue" },
  { name: "vadivam-svelte", directory: "packages/vadivam-svelte" },
  { name: "vadivam-solid", directory: "packages/vadivam-solid" },
  { name: "vadivam-angular", directory: "packages/vadivam-angular" },
  { name: "vadivam-astro", directory: "packages/vadivam-astro" },
  { name: "vadivam-preact", directory: "packages/vadivam-preact" },
];

export const packageDirectories = publishablePackages.map(
  ({ directory }) => directory,
);
