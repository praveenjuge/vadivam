import { chmod, copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pascalCase, styleIds, styles } from "../icon-styles.mjs";
import { iconCategories, lucideAliasesFor, root, sourceDirectory } from "../icon-source.mjs";
import { targetsById } from "../packages.mjs";
import * as angular from "./angular.mjs";
import * as astro from "./astro.mjs";
import { buildElements } from "./elements.mjs";
import * as lit from "./lit.mjs";
import * as preact from "./preact.mjs";
import * as qwik from "./qwik.mjs";
import * as reactNative from "./react-native.mjs";
import * as react from "./react.mjs";
import { runtimePolicyRecursiveSource } from "./runtime-policy.mjs";
import {
  buildStyles,
  defaultAttributesSource,
  exportedNames,
  iconAliases,
  iconImports,
  iconNameType,
  iconNode,
  iconRegistryEntries,
  iconRegistryTypes,
  isLabelledSource,
  mergeClassesSource,
  prepareDist,
  svgElementTypeSource,
  writeExports,
} from "./shared.mjs";
import * as solid from "./solid.mjs";
import { buildStaticAssets } from "./static.mjs";
import * as svelte from "./svelte.mjs";
import * as vue from "./vue.mjs";

// The core package exports each icon under its component name only.
const coreIconAliases = [["", ""]];

const indexExports = (icons, style) => [
  { from: "./createElement.js", values: ["createElement"] },
  { from: "./createIcons.js", values: ["createIcons"] },
  { from: "./iconNodes.js", values: ["icons"] },
  ...(style.entryDirectory ? [] : [{ from: "./manifest.js", values: ["icons as manifest", "iconNames", "iconsByName", "categories", "styles"] }]),
  { icons, aliases: coreIconAliases },
  { from: "./createIcons.js", types: ["CreateIconsOptions"] },
  ...(style.entryDirectory ? [] : [{ from: "./manifest.js", types: ["IconCategoryId", "VadivamIconCategory", "VadivamIconMetadata", "VadivamIconStyle", "VadivamIconStyleId"] }]),
  { from: `${style.shared}types.js`, types: ["IconName", "IconNode", "Icons", "SVGElementType", "SVGProps"] },
];

// The names each package exports besides its icons, and the aliases each icon
// is exported under, keyed by target id. The migrate-lucide codemod reads them
// from dist/package-exports.js to tell real exports from names to look up.
const packageApis = {
  core: { names: exportedNames(indexExports([], { shared: "./", entryDirectory: "" })), iconAliases: coreIconAliases },
  ...Object.fromEntries(
    Object.entries({ react, "react-native": reactNative, vue, svelte, solid, preact, astro, angular, qwik, lit })
      .map(([id, generator]) => [id, { names: generator.apiExports, iconAliases: generator.iconExportAliases ?? iconAliases }]),
  ),
};

// The docs site serves the same skill at /skill.md; ship one copy with the package.
const skillSource = path.join(root, "apps/docs/skills/vadivam-icons/SKILL.md");

// The package root holds what every style shares: types, the runtime policy,
// the manifest, the fonts, the elements, and the CLI. Each style is an entry
// with its icons, strings, sprite, and DOM helpers: outline at the root, solid
// under solid/.
export async function buildVadivamPackage({ icons, solidIcons, directory }) {
  const dist = path.join(directory, "dist");
  await prepareDist(dist);
  await writeFile(
    path.join(dist, "types.d.ts"),
    `export type SVGElementType = ${svgElementTypeSource};\nexport type SVGProps = Record<string, string | number | boolean | undefined>;\nexport type IconNode = readonly [tag: SVGElementType, attrs: SVGProps, children?: IconNode][];\nexport type Icons = Record<string, IconNode>;\nexport type IconName = ${iconNameType(icons)};\n`,
  );
  await writeFile(path.join(dist, "runtimePolicy.js"), runtimePolicyRecursiveSource);
  await buildStyles(dist, { outline: icons, solid: solidIcons }, (entry, styleIcons, style) =>
    buildEntry(entry, styleIcons, style, dist),
  );
  await buildElements(dist, { outline: icons, solid: solidIcons });
  await writeManifest(dist, icons, solidIcons);
  await writeFile(
    path.join(dist, "package-exports.js"),
    `// Generated with each package: its non-icon exports and the aliases ([prefix, suffix]) each icon is exported under.\nexport const packageExports = ${JSON.stringify(Object.fromEntries(Object.entries(packageApis).map(([id, api]) => [targetsById[id].packageName, api])), null, 2)};\n`,
  );
  // The Lucide migration CLI is hand-written in src/ and reads the generated
  // manifest, package exports, and deprecated Lucide aliases next to it.
  for (const file of ["cli.js", "migrate-lucide.js"]) {
    await copyFile(path.join(directory, "src", file), path.join(dist, file));
  }
  await chmod(path.join(dist, "cli.js"), 0o755);
  await writeFile(
    path.join(dist, "lucide-aliases.js"),
    lucideAliasesSource(await lucideAliasesFor(icons.map((icon) => icon.name)), icons),
  );
  const skills = path.join(directory, "skills");
  await rm(skills, { recursive: true, force: true });
  await mkdir(path.join(skills, "vadivam-icons"), { recursive: true });
  await copyFile(skillSource, path.join(skills, "vadivam-icons/SKILL.md"));
}

// Deprecated Lucide names and the canonical icon each one now points to, by
// icon name and by component name.
function lucideAliasesSource(aliases, icons) {
  const componentNames = new Map(icons.map((icon) => [icon.name, icon.componentName]));
  const componentAliases = Object.fromEntries(Object.entries(aliases).map(([alias, name]) => [pascalCase(alias), componentNames.get(name)]));
  return `// Deprecated Lucide names and the canonical icon each one now points to.\nexport const lucideAliases = ${JSON.stringify(aliases)};\nexport const lucideComponentAliases = ${JSON.stringify(componentAliases)};\n`;
}

async function writeManifest(dist, icons, solidIcons) {
  const solidByName = new Map(solidIcons.map((icon) => [icon.name, icon]));
  const solidPath = `${styles.solid.entryDirectory}/icons`;
  const manifestIcons = icons.map((icon) => {
    const solid = solidByName.get(icon.name);
    // The package ships solid SVGs under solid/icons, not the repository's
    // icons-solid folder.
    return { ...icon, solid: { svgPath: `${solidPath}/${solid.fileName}`, svg: solid.svg, iconNode: solid.iconNode } };
  });
  await writeFile(
    path.join(dist, "manifest.js"),
    `export const icons = ${JSON.stringify(manifestIcons, null, 2)};\nexport const iconNames = icons.map((icon) => icon.name);\nexport const iconsByName = Object.fromEntries(icons.map((icon) => [icon.name, icon]));\nexport const categories = ${JSON.stringify(iconCategories, null, 2)};\nexport const styles = ${JSON.stringify(styleIds)};\nexport default icons;\n`,
  );
  await writeFile(
    path.join(dist, "manifest.d.ts"),
    `import type { IconName, IconNode } from "./types.js";\nexport interface VadivamIconStyle {\n  svgPath: \`${solidPath}/${"${IconName}"}.svg\`;\n  svg: string;\n  iconNode: IconNode;\n}\nexport interface VadivamIconMetadata {\n  name: IconName;\n  componentName: string;\n  fileName: \`${"${IconName}"}.svg\`;\n  svgPath: \`${styles.outline.sourceDirectory}/${"${IconName}"}.svg\`;\n  /** Search terms from Lucide's metadata for this icon. */\n  tags: readonly string[];\n  /** Ids from \`categories\`. */\n  categories: readonly IconCategoryId[];\n  svg: string;\n  iconNode: IconNode;\n  /** The solid twin, drawn under the same name. */\n  solid?: VadivamIconStyle;\n}\nexport type IconCategoryId = ${iconCategories.map((category) => JSON.stringify(category.id)).join(" | ")};\nexport interface VadivamIconCategory {\n  id: IconCategoryId;\n  title: string;\n  description?: string;\n}\nexport type VadivamIconStyleId = ${styleIds.map((id) => JSON.stringify(id)).join(" | ")};\nexport declare const icons: readonly VadivamIconMetadata[];\nexport declare const iconNames: readonly IconName[];\nexport declare const iconsByName: Record<IconName, VadivamIconMetadata>;\nexport declare const categories: readonly VadivamIconCategory[];\n/** The styles every icon is drawn in. */\nexport declare const styles: readonly VadivamIconStyleId[];\nexport default icons;\n`,
  );
}

async function buildEntry(dist, icons, style, packageDist) {
  const { shared } = style;
  await mkdir(path.join(dist, "icons"), { recursive: true });
  for (const icon of icons) {
    await copyFile(path.join(sourceDirectory(style), icon.fileName), path.join(dist, "icons", icon.fileName));
    await writeFile(
      path.join(dist, "icons", `${icon.name}.js`),
      `const ${icon.componentName} = ${iconNode(icon)};\nexport default ${icon.componentName};\n`,
    );
    await writeFile(
      path.join(dist, "icons", `${icon.name}.d.ts`),
      `import type { IconNode } from "../${shared === "./" ? "" : "../"}types.js";\n/** @name ${icon.name}\n * @description Vadivam ${style.stroked ? "" : "solid "}SVG icon node.\n * @see https://vadivam.praveenjuge.com/icons/${icon.name}\n */\ndeclare const ${icon.componentName}: IconNode;\nexport default ${icon.componentName};\n`,
    );
  }
  await writeFile(
    path.join(dist, "defaultAttributes.js"),
    `const defaultAttributes = ${defaultAttributesSource(style)};\nexport default defaultAttributes;\n`,
  );
  await writeFile(
    path.join(dist, "createElement.js"),
    `import defaultAttributes from "./defaultAttributes.js";\nimport { sanitizeIconNode, sanitizeRootAttributes } from "${shared}runtimePolicy.js";\n\nfunction createSvgElement(document, [tag, attrs, children]) {\n  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);\n  for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, String(value));\n  for (const child of children ?? []) element.appendChild(createSvgElement(document, child));\n  return element;\n}\n\nexport function createElement(iconNode, customAttrs = {}) {\n  if (typeof document === "undefined") throw new Error("createElement() only works in a browser environment.");\n  return createSvgElement(document, ["svg", { ...defaultAttributes, ...sanitizeRootAttributes(customAttrs) }, sanitizeIconNode(iconNode)]);\n}\nexport default createElement;\n`,
  );
  await writeFile(
    path.join(dist, "createElement.d.ts"),
    `import type { IconNode, SVGProps } from "${shared}types.js";\nexport declare function createElement(iconNode: IconNode, customAttrs?: SVGProps): SVGElement;\nexport default createElement;\n`,
  );
  await writeFile(
    path.join(dist, "iconNodes.js"),
    `${iconImports(icons)}\n\nexport const icons = {\n${iconRegistryEntries(icons)}\n};\nexport default icons;\n`,
  );
  await writeFile(
    path.join(dist, "iconNodes.d.ts"),
    `import type { IconNode } from "${shared}types.js";\nexport declare const icons: {\n${iconRegistryTypes(icons, "IconNode")}\n};\nexport default icons;\n`,
  );
  await writeFile(
    path.join(dist, "createIcons.js"),
    `import createElement from "./createElement.js";
import defaultAttributes from "./defaultAttributes.js";
import { sanitizeRootAttributes } from "${shared}runtimePolicy.js";

function attributes(element) {
  return Object.fromEntries(Array.from(element.attributes, ({ name, value }) => [name, value]));
}
${mergeClassesSource()}
${isLabelledSource()}
function replaceElement(element, { nameAttr, icons, attrs }) {
  const name = element.getAttribute(nameAttr);
  if (!name) return;
  const componentName = name.split("-").filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join("");
  const iconNode = icons[componentName];
  if (!iconNode) {
    console.warn(\`\${element.outerHTML} icon name was not found in the provided icons object.\`);
    return;
  }
  const elementAttrs = attributes(element);
  const iconAttrs = { ...defaultAttributes, [nameAttr]: name, ...(isLabelled(null, Object.keys(sanitizeRootAttributes({ ...attrs, ...elementAttrs }))) ? {} : { "aria-hidden": "true" }), ...attrs, ...elementAttrs };
  iconAttrs.class = mergeClasses("vadivam", \`vadivam-\${name}\`, elementAttrs.class, ...[attrs.class].flat());
  element.parentNode?.replaceChild(createElement(iconNode, iconAttrs), element);
}

export function createIcons({ icons = {}, nameAttr = "data-vadivam", attrs = {}, root = globalThis.document, inTemplates = false } = {}) {
  if (!Object.keys(icons).length) throw new Error("Please provide an icons object to createIcons().");
  if (!root) throw new Error("createIcons() only works in a browser environment.");
  if (!/^[A-Za-z_:][A-Za-z0-9_.:-]*$/.test(nameAttr)) throw new Error("createIcons() received an invalid nameAttr.");
  // A valid attribute name may hold "." or ":", which a selector must escape.
  for (const element of root.querySelectorAll(\`[\${nameAttr.replace(/[.:]/g, "\\\\$&")}]\`)) replaceElement(element, { nameAttr, icons, attrs });
  if (inTemplates) {
    for (const template of root.querySelectorAll("template")) createIcons({ icons, nameAttr, attrs, root: template.content, inTemplates });
  }
}
export default createIcons;
`,
  );
  await writeFile(
    path.join(dist, "createIcons.d.ts"),
    `import type { Icons, SVGProps } from "${shared}types.js";\nexport interface CreateIconsOptions {\n  icons?: Icons;\n  nameAttr?: string;\n  attrs?: SVGProps;\n  root?: Element | Document | DocumentFragment;\n  inTemplates?: boolean;\n}\nexport declare function createIcons(options?: CreateIconsOptions): void;\nexport default createIcons;\n`,
  );
  await writeExports(dist, "index", indexExports(icons, style));
  await buildStaticAssets(icons, {
    iconsDirectory: sourceDirectory(style),
    outputDirectory: dist,
    fontDirectory: path.join(packageDist, "font"),
    style: styles[style.id],
  });
}
