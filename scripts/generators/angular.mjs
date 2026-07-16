import { spawnSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { iconNameType, iconNode, write } from "./shared.mjs";

function runAngularPackager(root) {
  const result = spawnSync(
    "bun",
    ["x", "ng-packagr", "-p", "packages/vadivam-angular/.generated/ng-package.json"],
    { cwd: root, stdio: "inherit" },
  );
  if (result.status !== 0) throw new Error("ng-packagr failed for vadivam-angular");
}

export async function buildAngularPackage(icons, packageDir, root) {
  const generated = path.join(packageDir, ".generated", "src");
  const dist = path.join(packageDir, "dist");
  await rm(path.join(packageDir, ".generated"), { recursive: true, force: true });
  await rm(dist, { recursive: true, force: true });
  await mkdir(path.join(generated, "icons"), { recursive: true });
  await write(
    path.join(packageDir, ".generated"),
    "package.json",
    `${JSON.stringify({
      name: "vadivam-angular",
      version: "0.0.0",
      peerDependencies: {
        "@angular/common": ">=22 <23",
        "@angular/core": ">=22 <23",
      },
      dependencies: { tslib: "^2.8.1" },
    }, null, 2)}\n`,
  );
  await write(
    path.join(packageDir, ".generated"),
    "ng-package.json",
    `${JSON.stringify({
      $schema: "../../../node_modules/ng-packagr/ng-package.schema.json",
      dest: "../dist",
      lib: { entryFile: "src/public-api.ts" },
    }, null, 2)}\n`,
  );
  const common = `import { Directive, ElementRef, effect, inject, InjectionToken, input, Provider, Renderer2 } from "@angular/core";\nexport type SVGElementType = "circle" | "ellipse" | "line" | "path" | "polygon" | "polyline" | "rect";\nexport type IconNode = readonly [tag: SVGElementType, attrs: Record<string, string>][];\nexport interface VadivamIconData { name: string; iconNode: IconNode; }\nexport interface VadivamConfig { size?: string | number; color?: string; strokeWidth?: string | number; absoluteStrokeWidth?: boolean; class?: string; }\nexport type IconName = ${iconNameType(icons)};\nexport const VADIVAM_CONFIG = new InjectionToken<VadivamConfig>("vadivam-icons", { factory: () => ({}) });\nexport function provideVadivamConfig(config: VadivamConfig): Provider { return { provide: VADIVAM_CONFIG, useValue: Object.freeze({ ...config }) }; }\nexport function createVadivamIcon(name: string, iconNode: IconNode): VadivamIconData { return Object.freeze({ name, iconNode }); }\nconst defaults = { size: 24, color: "currentColor", strokeWidth: 2 };\n@Directive({ standalone: true })\nexport abstract class VadivamIconBase {\n  protected defaultName = "";\n  protected defaultIconNode: IconNode = [];\n  readonly name = input<string>();\n  readonly iconNode = input<IconNode>();\n  readonly size = input<string | number>();\n  readonly color = input<string>();\n  readonly strokeWidth = input<string | number>();\n  readonly absoluteStrokeWidth = input<boolean | string>();\n  readonly title = input<string>();\n  protected readonly element = inject<ElementRef<SVGSVGElement>>(ElementRef).nativeElement;\n  protected readonly renderer = inject(Renderer2);\n  protected readonly config = inject(VADIVAM_CONFIG);\n  private runtimeName?: string;\n  private runtimeIconNode?: IconNode;\n  private rendered: Node[] = [];\n  private generatedClasses = new Set<string>();\n  private decorative = false;\n  constructor() { effect(() => { this.name(); this.iconNode(); this.size(); this.color(); this.strokeWidth(); this.absoluteStrokeWidth(); this.title(); this.render(); }); }\n  protected setRuntimeIcon(name: string, iconNode: IconNode) { this.runtimeName = name; this.runtimeIconNode = iconNode; this.render(); }\n  protected render() {\n    for (const child of this.rendered) this.renderer.removeChild(this.element, child);\n    for (const className of this.generatedClasses) this.renderer.removeClass(this.element, className);\n    if (this.decorative) this.renderer.removeAttribute(this.element, "aria-hidden");\n    this.rendered = [];\n    this.generatedClasses.clear();\n    this.decorative = false;\n    const name = this.runtimeName ?? this.name() ?? this.defaultName;\n    const iconNode = this.runtimeIconNode ?? this.iconNode() ?? this.defaultIconNode;\n    const size = this.size() ?? this.config.size ?? defaults.size;\n    const stroke = this.strokeWidth() ?? this.config.strokeWidth ?? defaults.strokeWidth;\n    const numericSize = Number(size);\n    const numericStroke = Number(stroke);\n    const absoluteInput = this.absoluteStrokeWidth();\n    const absolute = absoluteInput === "" || absoluteInput === true || absoluteInput === "true" || (absoluteInput == null && this.config.absoluteStrokeWidth === true);\n    const calculated = absolute && Number.isFinite(numericSize) && numericSize !== 0 && Number.isFinite(numericStroke) ? numericStroke * 24 / numericSize : stroke;\n    const attrs: Record<string, string | number> = { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: this.color() ?? this.config.color ?? defaults.color, "stroke-width": calculated, "stroke-linecap": "round", "stroke-linejoin": "round" };\n    for (const [key, value] of Object.entries(attrs)) this.renderer.setAttribute(this.element, key, String(value));\n    const classes = ["vadivam", name && \`vadivam-\${name}\`, ...(this.config.class ?? "").split(/\\s+/)].filter(Boolean) as string[];\n    for (const className of new Set(classes)) { this.renderer.addClass(this.element, className); this.generatedClasses.add(className); }\n    const titleText = this.title();\n    if (titleText) { const title = this.renderer.createElement("title", "svg"); this.renderer.appendChild(title, this.renderer.createText(titleText)); this.renderer.appendChild(this.element, title); this.rendered.push(title); this.renderer.setAttribute(this.element, "role", "img"); }\n    const labelled = titleText || Array.from(this.element.attributes).some(({ name: attribute }) => attribute.startsWith("aria-") || attribute === "role");\n    if (!labelled) { this.renderer.setAttribute(this.element, "aria-hidden", "true"); this.decorative = true; }\n    for (const [tag, nodeAttrs] of iconNode) { const child = this.renderer.createElement(tag, "svg"); for (const [key, value] of Object.entries(nodeAttrs)) if (key !== "key") this.renderer.setAttribute(child, key, String(value)); this.renderer.appendChild(this.element, child); this.rendered.push(child); }\n  }\n}\n@Directive({ selector: "svg[vadivamIcon]", standalone: true })\nexport class Icon extends VadivamIconBase {\n  readonly definition = input<VadivamIconData | IconNode | null>(null, { alias: "vadivamIcon" });\n  constructor() { super(); effect(() => { const value = this.definition(); if (Array.isArray(value)) this.setRuntimeIcon("", value as IconNode); else if (value) this.setRuntimeIcon(value.name, value.iconNode); }); }\n}\n`;
  await write(
    generated,
    "core.ts",
    common.replace(
      "else if (value) this.setRuntimeIcon",
      'else if (value && "name" in value) this.setRuntimeIcon',
    ),
  );
  const publicExports = [];
  for (const icon of icons) {
    const source = `import { Directive } from "@angular/core";\nimport { IconNode, VadivamIconBase } from "../core";\nexport const __iconNode: IconNode = ${iconNode(icon)};\nexport const ${icon.componentName}Node = __iconNode;\n@Directive({ selector: "svg[vadivam${icon.componentName}]", standalone: true })\nexport class ${icon.componentName} extends VadivamIconBase { protected override defaultName = "${icon.name}"; protected override defaultIconNode = __iconNode; }\nexport { ${icon.componentName} as ${icon.componentName}Icon, ${icon.componentName} as Vadivam${icon.componentName} };\nexport default ${icon.componentName};\n`;
    await write(generated, `icons/${icon.name}.ts`, source);
    publicExports.push(`export { ${icon.componentName}, ${icon.componentName}Icon, Vadivam${icon.componentName}, ${icon.componentName}Node } from "./icons/${icon.name}";`);
  }
  const iconDataEntries = icons
    .map(
      ({ componentName, name }) =>
        `  ${componentName}: createVadivamIcon("${name}", ${componentName}Node)`,
    )
    .join(",\n");
  const iconImports = icons
    .map(
      ({ componentName, name }) =>
        `import { ${componentName}Node } from "./icons/${name}";`,
    )
    .join("\n");
  const dynamicImports = icons
    .map(
      ({ name }) =>
        `  ${JSON.stringify(name)}: () => import("./icons/${name}")`,
    )
    .join(",\n");
  await write(generated, "registry.ts", `import { createVadivamIcon } from "./core";\n${iconImports}\nexport const icons = {\n${iconDataEntries}\n} as const;\nexport default icons;\n`);
  await write(generated, "dynamic.ts", `import { Directive, effect, input } from "@angular/core";\nimport { IconName, IconNode, VadivamIconBase } from "./core";\nexport const dynamicIconImports = {\n${dynamicImports}\n} as const;\nexport const iconNames = Object.keys(dynamicIconImports) as IconName[];\n@Directive({ selector: "svg[vadivamDynamicIcon]", standalone: true })\nexport class DynamicIcon extends VadivamIconBase {\n  readonly fallback = input<IconNode>([]);\n  readonly dynamicName = input.required<IconName | string>({ alias: "vadivamDynamicIcon" });\n  private request = 0;\n  constructor() { super(); effect(() => { const name = this.dynamicName(); const fallback = this.fallback(); const id = ++this.request; this.setRuntimeIcon(name, fallback); const importer = dynamicIconImports[name as IconName]; if (importer) importer().then((module) => { if (this.request === id) this.setRuntimeIcon(name, module.__iconNode); }, () => { if (this.request === id) this.setRuntimeIcon(name, fallback); }); }); }\n}\n`);
  await write(generated, "public-api.ts", `export * from "./core";\nexport * from "./registry";\nexport * from "./dynamic";\n${publicExports.join("\n")}\n`);
  runAngularPackager(root);
  await rm(path.join(dist, "package.json"), { force: true });
  const fesm = "../fesm2022/vadivam-angular.mjs";
  const types = "../types/vadivam-angular.d.ts";
  for (const icon of icons) {
    await write(dist, `icons/${icon.name}.js`, `export { ${icon.componentName} as default, ${icon.componentName}, ${icon.componentName}Icon, Vadivam${icon.componentName}, ${icon.componentName}Node as __iconNode } from "${fesm}";\n`);
    await write(dist, `icons/${icon.name}.d.ts`, `export { ${icon.componentName} as default, ${icon.componentName}, ${icon.componentName}Icon, Vadivam${icon.componentName}, ${icon.componentName}Node as __iconNode } from "${types}";\n`);
  }
}
