import { spawnSync } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { pascalCase, styles } from "../icon-styles.mjs";
import { root } from "../icon-source.mjs";
import { runtimePolicyTypeScriptSource } from "./runtime-policy.mjs";
import {
  defaultAttributesSource,
  defaultSize,
  defaultStrokeWidth,
  dynamicEntries,
  iconAliases,
  iconExportNames,
  iconNameType,
  iconNode,
  isLabelledSource,
  objectEntries,
  paintBindings,
  scaledStrokeWidthSource,
  svgElementTypeSource,
  write,
} from "./shared.mjs";

// ng-packagr compiles .generated into dist: the primary entry from src/, and
// each other style as a secondary entry point, vadivam-angular/solid, built on
// the primary entry's base directive and config. A style's selectors carry its
// name ("vadivamSolid…") so outline and solid icons can share a template.
function entryOf(style) {
  const primary = !style.entryDirectory;
  return {
    source: primary ? "src" : style.entryDirectory,
    selector: `vadivam${pascalCase(style.entryDirectory)}`,
    core: primary ? "./core" : "vadivam-angular",
    iconCore: primary ? "../core" : "vadivam-angular",
    bundle: primary ? "vadivam-angular" : `vadivam-angular-${style.entryDirectory}`,
    overrides: style.stroked ? "" : "protected override stroked = false; ",
  };
}

/** Every name the package exports besides the icons, as its .generated sources declare them. */
export const apiExports = [
  "IconNode", "SVGElementType", "VadivamIconData", "VadivamConfig", "IconName", "VADIVAM_CONFIG", "provideVadivamConfig",
  "createVadivamIcon", "VadivamIconBase", "Icon", "icons", "DynamicIconModule", "dynamicIconImports", "iconNames", "DynamicIcon",
];
/** Each icon is exported under its aliases and as its icon node, `<Name>Node`. */
export const iconExportAliases = [...iconAliases, ["", "Node"]];
const iconExportsOf = (componentName) => iconExportAliases.map(([prefix, suffix]) => `${prefix}${componentName}${suffix}`);

export async function buildAngularPackage({ icons, solidIcons, directory }) {
  const generated = path.join(directory, ".generated");
  const dist = path.join(directory, "dist");
  const manifest = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"));
  await rm(generated, { recursive: true, force: true });
  await rm(dist, { recursive: true, force: true });
  await write(generated, "package.json", `${JSON.stringify({
    name: manifest.name,
    version: "0.0.0",
    peerDependencies: manifest.peerDependencies,
    dependencies: manifest.dependencies,
  }, null, 2)}\n`);
  await write(generated, "ng-package.json", `${JSON.stringify({
    $schema: "../../../node_modules/ng-packagr/ng-package.schema.json",
    dest: "../dist",
    lib: { entryFile: "src/public-api.ts" },
  }, null, 2)}\n`);
  await write(generated, "src/runtime-policy.ts", `export type SVGElementType = ${svgElementTypeSource};\nexport type IconNode = readonly [tag: SVGElementType, attrs: Record<string, string | number | boolean>][];\n${runtimePolicyTypeScriptSource}`);
  const iconsByStyle = { outline: icons, solid: solidIcons };
  for (const style of Object.values(styles)) {
    if (iconsByStyle[style.id].length) await writeEntry(path.join(generated, entryOf(style).source), iconsByStyle[style.id], style, icons);
  }
  const result = spawnSync("bun", ["x", "ng-packagr", "-p", path.join(generated, "ng-package.json")], { cwd: root, stdio: "inherit" });
  if (result.status !== 0) throw new Error("ng-packagr failed for vadivam-angular");
  // ng-packagr writes package.json files that the root exports map replaces.
  await rm(path.join(dist, "package.json"), { force: true });
  await rm(path.join(dist, ".npmignore"), { force: true });
  // Each icon subpath re-exports its directive from the entry's bundle.
  for (const style of Object.values(styles)) {
    const { bundle } = entryOf(style);
    const up = style.entryDirectory ? "../../" : "../";
    if (style.entryDirectory) await rm(path.join(dist, style.entryDirectory, "package.json"), { force: true });
    for (const { componentName, name } of iconsByStyle[style.id]) {
      const names = `${componentName} as default, ${iconExportNames(componentName).join(", ")}, ${componentName}Node as __iconNode`;
      const subpath = path.join(style.entryDirectory, "icons", name);
      await write(dist, `${subpath}.js`, `export { ${names} } from "${up}fesm2022/${bundle}.mjs";\n`);
      await write(dist, `${subpath}.d.ts`, `export { ${names} } from "${up}types/${bundle}.d.ts";\n`);
    }
  }
}

async function writeEntry(directory, icons, style, outlineIcons) {
  const { selector, core, iconCore, overrides } = entryOf(style);
  if (style.entryDirectory) {
    await write(directory, "ng-package.json", `${JSON.stringify({ lib: { entryFile: "public-api.ts" } }, null, 2)}\n`);
    await write(directory, "core.ts", `import { Directive, effect, input } from "@angular/core";\nimport { VadivamIconBase } from "vadivam-angular";\nimport type { IconNode, VadivamIconData } from "vadivam-angular";\nexport { VADIVAM_CONFIG, createVadivamIcon, provideVadivamConfig } from "vadivam-angular";\nexport type { IconName, IconNode, SVGElementType, VadivamConfig, VadivamIconData } from "vadivam-angular";\n${iconDirective(style)}`);
  } else {
    await write(directory, "core.ts", `${baseSource(outlineIcons)}${iconDirective(style)}`);
  }
  const publicExports = [];
  for (const icon of icons) {
    const [componentName, ...aliases] = iconExportNames(icon.componentName);
    await write(directory, `icons/${icon.name}.ts`, `import { Directive } from "@angular/core";\nimport { IconNode, VadivamIconBase } from "${iconCore}";\nexport const __iconNode: IconNode = ${iconNode(icon)};\nexport const ${componentName}Node = __iconNode;\n@Directive({ selector: "svg[${selector}${componentName}]", standalone: true })\nexport class ${componentName} extends VadivamIconBase { ${overrides}protected override defaultName = "${icon.name}"; protected override defaultIconNode = __iconNode; }\nexport { ${aliases.map((alias) => `${componentName} as ${alias}`).join(", ")} };\nexport default ${componentName};\n`);
    publicExports.push(`export { ${iconExportsOf(componentName).join(", ")} } from "./icons/${icon.name}";`);
  }
  const iconImports = icons.map(({ componentName, name }) => `import { ${componentName}Node } from "./icons/${name}";`).join("\n");
  const iconData = icons.map(({ componentName, name }) => `  ${componentName}: createVadivamIcon("${name}", ${componentName}Node)`).join(",\n");
  await write(directory, "registry.ts", `import { createVadivamIcon } from "${core}";\n${iconImports}\nexport const icons = {\n${iconData}\n} as const;\nexport default icons;\n`);
  await write(directory, "dynamic.ts", `import { Directive, effect, input } from "@angular/core";\nimport { IconName, IconNode, VadivamIconBase } from "${core}";\nexport interface DynamicIconModule { __iconNode: IconNode; }\nexport const dynamicIconImports: { readonly [K in IconName]: () => Promise<DynamicIconModule> } = {\n${dynamicEntries(icons, { extension: "" })}\n};\nexport const iconNames = Object.keys(dynamicIconImports) as IconName[];\n@Directive({ selector: "svg[${selector}DynamicIcon]", standalone: true })\nexport class DynamicIcon extends VadivamIconBase {\n  ${overrides ? `${overrides.trim()}\n  ` : ""}readonly fallback = input<IconNode>([]);\n  readonly dynamicName = input.required<IconName | string>({ alias: "${selector}DynamicIcon" });\n  private request = 0;\n  constructor() { super(); effect(() => { const name = this.dynamicName(); const fallback = this.fallback(); const id = ++this.request; this.setRuntimeIcon(name, fallback); const importer = Object.prototype.hasOwnProperty.call(dynamicIconImports, name) ? dynamicIconImports[name as IconName] : undefined; if (importer) importer().then((module) => { if (this.request === id) this.setRuntimeIcon(name, module.__iconNode); }, () => { if (this.request === id) this.setRuntimeIcon(name, fallback); }); }); }\n}\n`);
  await write(directory, "public-api.ts", `export * from "./core";\nexport * from "./registry";\nexport * from "./dynamic";\n${publicExports.join("\n")}\n`);
}

function iconDirective(style) {
  const { selector, overrides } = entryOf(style);
  return `@Directive({ selector: "svg[${selector}Icon]", standalone: true })\nexport class Icon extends VadivamIconBase {\n  ${overrides ? `${overrides.trim()}\n  ` : ""}readonly definition = input<VadivamIconData | IconNode | null>(null, { alias: "${selector}Icon" });\n  constructor() { super(); effect(() => { const value = this.definition(); if (Array.isArray(value)) this.setRuntimeIcon("", value as IconNode); else if (value && "name" in value) this.setRuntimeIcon(value.name, value.iconNode); }); }\n}\n`;
}

// The base directive every icon extends. Its attributes follow the render
// contract in shared.mjs; a solid icon sets `stroked` to false.
function baseSource(icons) {
  const attributes = (style) => `{ ...${style.stroked ? "strokedAttributes" : "filledAttributes"}, width: size, height: size, ${objectEntries(paintBindings(style, { color: "paint", strokeWidth: "stroke", size: "size", absolute: "absolute" }))} }`;
  return `import { Directive, ElementRef, effect, inject, InjectionToken, input, Provider, Renderer2 } from "@angular/core";\nimport { sanitizeIconNode, sanitizePaint } from "./runtime-policy";\nimport type { IconNode, SVGElementType } from "./runtime-policy";\nexport type { IconNode, SVGElementType } from "./runtime-policy";\nexport interface VadivamIconData { name: string; iconNode: IconNode; }\nexport interface VadivamConfig { size?: string | number; color?: string; strokeWidth?: string | number; absoluteStrokeWidth?: boolean; class?: string; }\nexport type IconName = ${iconNameType(icons)};\nexport const VADIVAM_CONFIG = new InjectionToken<VadivamConfig>("vadivam-icons", { factory: () => ({}) });\nexport function provideVadivamConfig(config: VadivamConfig): Provider { return { provide: VADIVAM_CONFIG, useValue: Object.freeze({ ...config }) }; }\nexport function createVadivamIcon(name: string, iconNode: IconNode): VadivamIconData { return Object.freeze({ name, iconNode }); }\nconst defaults = { size: ${defaultSize}, color: "currentColor", strokeWidth: ${defaultStrokeWidth} };\nconst strokedAttributes = ${defaultAttributesSource(styles.outline)};\nconst filledAttributes = ${defaultAttributesSource(styles.solid)};\n${isLabelledSource({ typeScript: true })}\n${scaledStrokeWidthSource({ typeScript: true })}\n@Directive({ standalone: true })\nexport abstract class VadivamIconBase {\n  protected defaultName = "";\n  protected defaultIconNode: IconNode = [];\n  /** Outline icons paint a stroke; solid icons override this to paint a fill. */\n  protected stroked = true;\n  readonly name = input<string>();\n  readonly iconNode = input<IconNode>();\n  readonly size = input<string | number>();\n  readonly color = input<string>();\n  readonly strokeWidth = input<string | number>();\n  readonly absoluteStrokeWidth = input<boolean | string>();\n  readonly title = input<string>();\n  protected readonly element = inject<ElementRef<SVGSVGElement>>(ElementRef).nativeElement;\n  protected readonly renderer = inject(Renderer2);\n  protected readonly config = inject(VADIVAM_CONFIG);\n  private runtimeName?: string;\n  private runtimeIconNode?: IconNode;\n  private rendered: Node[] = [];\n  private generatedClasses = new Set<string>();\n  private decorative = false;\n  constructor() { effect(() => { this.name(); this.iconNode(); this.size(); this.color(); this.strokeWidth(); this.absoluteStrokeWidth(); this.title(); this.render(); }); }\n  protected setRuntimeIcon(name: string, iconNode: IconNode) { this.runtimeName = name; this.runtimeIconNode = iconNode; this.render(); }\n  protected render() {\n    for (const child of this.rendered) this.renderer.removeChild(this.element, child);\n    for (const className of this.generatedClasses) this.renderer.removeClass(this.element, className);\n    if (this.decorative) this.renderer.removeAttribute(this.element, "aria-hidden");\n    this.rendered = [];\n    this.generatedClasses.clear();\n    this.decorative = false;\n    const name = this.runtimeName ?? this.name() ?? this.defaultName;\n    // The default node was generated with the package and passed the runtime policy when it was built.\n    const callerIconNode = this.runtimeIconNode ?? this.iconNode();\n    const iconNode = callerIconNode ? sanitizeIconNode(callerIconNode) : this.defaultIconNode;\n    const size = this.size() ?? this.config.size ?? defaults.size;\n    const stroke = this.strokeWidth() ?? this.config.strokeWidth ?? defaults.strokeWidth;\n    const absoluteInput = this.absoluteStrokeWidth();\n    const absolute = absoluteInput === "" || absoluteInput === true || absoluteInput === "true" || (absoluteInput == null && this.config.absoluteStrokeWidth === true);\n    const paint = sanitizePaint(this.color() ?? this.config.color);\n    const attrs: Record<string, string | number> = this.stroked ? ${attributes(styles.outline)} : ${attributes(styles.solid)};\n    for (const [key, value] of Object.entries(attrs)) this.renderer.setAttribute(this.element, key, String(value));\n    const classes = ["vadivam", name && \`vadivam-\${name}\`, ...(this.config.class ?? "").split(/\\s+/)].filter(Boolean) as string[];\n    for (const className of new Set(classes)) { this.renderer.addClass(this.element, className); this.generatedClasses.add(className); }\n    const titleText = this.title();\n    if (titleText) { const title = this.renderer.createElement("title", "svg"); this.renderer.appendChild(title, this.renderer.createText(titleText)); this.renderer.appendChild(this.element, title); this.rendered.push(title); this.renderer.setAttribute(this.element, "role", "img"); }\n    if (!isLabelled(titleText, Array.from(this.element.attributes, (attribute) => attribute.name))) { this.renderer.setAttribute(this.element, "aria-hidden", "true"); this.decorative = true; }\n    for (const [tag, nodeAttrs] of iconNode) { const child = this.renderer.createElement(tag, "svg"); for (const [key, value] of Object.entries(nodeAttrs)) if (key !== "key") this.renderer.setAttribute(child, key, String(value)); this.renderer.appendChild(this.element, child); this.rendered.push(child); }\n  }\n}\n`;
}
