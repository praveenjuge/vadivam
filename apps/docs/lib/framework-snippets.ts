/** Build example source without a literal `import {` statement Vite can scan. */
const namedImport = (name: string, pkg: string) =>
  ["import { ", name, " } from ", JSON.stringify(pkg), ";"].join("");

export function usageCode(tab: string, name: string, svg = ""): string {
  switch (tab) {
    case "react":
      return `${namedImport(name, "vadivam-react")}\n\n<${name} />`;
    case "solid":
      return `${namedImport(name, "vadivam-solid")}\n\n<${name} />`;
    case "preact":
      return `${namedImport(name, "vadivam-preact")}\n\n<${name} />`;
    case "vue":
      return `<script setup>\n${namedImport(name, "vadivam-vue")}\n</script>\n\n<template>\n  <${name} />\n</template>`;
    case "svelte":
      return `<script>\n  ${namedImport(name, "vadivam-svelte")}\n</script>\n\n<${name} />`;
    case "astro":
      return `---\n${namedImport(name, "vadivam-astro")}\n---\n\n<${name} />`;
    case "angular":
      return `${namedImport(name, "vadivam-angular")}\n\n<svg vadivam${name}></svg>`;
    default:
      return svg;
  }
}

export function snippetTemplate(tab: string, name: string): { lang: string; code: string } | null {
  switch (tab) {
    case "react":
    case "solid":
    case "preact":
      return { lang: "tsx", code: usageCode(tab, name) };
    case "vue":
      return { lang: "vue", code: usageCode(tab, name) };
    case "svelte":
      return { lang: "svelte", code: usageCode(tab, name) };
    case "astro":
      return { lang: "astro", code: usageCode(tab, name) };
    case "angular":
      return { lang: "ts", code: usageCode(tab, name) };
    default:
      return null;
  }
}

export function frameworkUsage(name: string): { title: string; lang: string; code: string }[] {
  return [
    { title: "React", lang: "tsx", code: usageCode("react", name) },
    { title: "Vue", lang: "vue", code: usageCode("vue", name) },
    { title: "Svelte", lang: "svelte", code: usageCode("svelte", name) },
    { title: "Solid", lang: "tsx", code: usageCode("solid", name) },
    { title: "Preact", lang: "tsx", code: usageCode("preact", name) },
    { title: "Astro", lang: "astro", code: usageCode("astro", name) },
    { title: "Angular", lang: "ts", code: usageCode("angular", name) },
  ];
}
