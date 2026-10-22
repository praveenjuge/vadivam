import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { lucideAliases } from "./lucide-aliases.js";
import { icons } from "./manifest.js";

// Every Vadivam icon keeps its Lucide name, and each framework package mirrors
// the matching Lucide package's API with Lucide renamed to Vadivam. So moving
// over is a package rename plus `Lucide` -> `Vadivam` in imported identifiers.
export const packageMap = {
  lucide: "vadivam",
  "lucide-react": "vadivam-react",
  "lucide-react-native": "vadivam-react-native",
  "lucide-vue-next": "vadivam-vue",
  "@lucide/vue": "vadivam-vue",
  "lucide-svelte": "vadivam-svelte",
  "@lucide/svelte": "vadivam-svelte",
  "lucide-solid": "vadivam-solid",
  "lucide-preact": "vadivam-preact",
  "@lucide/astro": "vadivam-astro",
};

// Packages whose API differs enough that they need a hand migration.
const manualPackages = {
  "lucide-angular": "vadivam-angular uses one standalone directive per icon",
  "@lucide/angular": "vadivam-angular uses one standalone directive per icon",
  "lucide-static": "use vadivam/icons/<name>.svg, vadivam/strings/<name>, the sprite, or the font",
  "lucide-vue": "Vue 2 is not supported; vadivam-vue targets Vue 3",
};

export const guideUrl = "https://vadivam.praveenjuge.com/docs/migrate-from-lucide";

const sourceExtensions = new Set([
  ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts",
  ".vue", ".svelte", ".astro", ".mdx", ".html",
]);
const styleExtensions = new Set([".css", ".scss", ".sass", ".less"]);
const skippedDirectories = new Set([
  "node_modules", ".git", "dist", "build", "out", "coverage",
  ".next", ".nuxt", ".output", ".svelte-kit", ".astro", ".turbo", ".vercel", ".expo",
]);
const dependencyFields = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];

const iconNames = new Set(icons.map((icon) => icon.name));
const componentNames = new Map(icons.map((icon) => [icon.name, icon.componentName]));
// Deprecated Lucide component names (AlertCircle) and the canonical ones (CircleAlert).
const pascalCase = (name) => name.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join("");
const componentAliases = new Map(
  Object.entries(lucideAliases).map(([alias, name]) => [pascalCase(alias), componentNames.get(name)]),
);
const iconExports = new Set(
  icons.flatMap(({ componentName }) => [componentName, `${componentName}Icon`, `Vadivam${componentName}`]),
);
// The non-icon exports across the core and framework packages.
const apiExports = new Set([
  "Icon", "createIcon", "createVadivamIcon", "icons", "iconNames", "dynamicIconImports", "DynamicIcon",
  "VadivamProvider", "useVadivamContext", "provideVadivam", "VadivamContext", "VADIVAM_CONTEXT",
  "getVadivamContext", "setVadivamProps", "createElement", "createIcons", "manifest", "iconsByName",
  "categories", "IconName", "IconNode", "Icons", "SVGElementType", "SVGAttributes", "SVGProps",
  "VadivamProps", "VadivamIcon", "IconDefinition", "CreateIconsOptions", "IconCategoryId",
  "VadivamIconCategory", "VadivamIconMetadata", "default",
]);

const specifierPattern = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*|\.mock\s*\(\s*)(["'])([^"'\n]+)\2/g;
const lucideIdentifierPattern = /\b[A-Za-z_$][\w$]*\b/g;
const namedImportPattern = /\bimport\s+(?:type\s+)?(?:[\w$]+\s*,\s*)?\{([^}]*)\}\s*from\s*["'](vadivam(?:-[a-z-]+)?)(\/dynamic)?["']/g;

function splitSpecifier(specifier) {
  const parts = specifier.split("/");
  const length = specifier.startsWith("@") ? 2 : 1;
  return { name: parts.slice(0, length).join("/"), subpath: parts.slice(length).join("/") };
}

/** The Vadivam specifier for a Lucide one, or a reason it cannot be mapped. */
export function mapSpecifier(specifier) {
  const { name, subpath } = splitSpecifier(specifier);
  if (manualPackages[name]) return { manual: `${name}: ${manualPackages[name]}` };
  const target = packageMap[name];
  if (!target) return null;
  if (subpath === "") return { specifier: target };
  if (target !== "vadivam" && (subpath === "dynamic" || subpath === "dynamicIconImports")) {
    return { specifier: `${target}/${subpath}` };
  }
  const iconPath = subpath.match(/^(?:dist\/esm\/)?icons\/([a-z0-9-]+?)(?:\.m?js)?$/)?.[1];
  const icon = lucideAliases[iconPath] ?? iconPath;
  if (icon) {
    if (!iconNames.has(icon)) return { manual: `${specifier}: Vadivam has no "${icon}" icon` };
    return { specifier: `${target}/icons/${icon}` };
  }
  return { manual: `${specifier}: no Vadivam equivalent for this subpath` };
}

/** The canonical export for a deprecated Lucide one: AlertCircleIcon -> CircleAlertIcon. */
function canonicalExport(name) {
  const [, prefix, base, suffix] = name.match(/^(Vadivam)?(\w+?)(Icon)?$/) ?? [];
  const canonical = base && componentAliases.get(base);
  return canonical ? `${prefix ?? ""}${canonical}${suffix ?? ""}` : name;
}

const renameIdentifier = (identifier) =>
  identifier !== "Lucide" && identifier !== "LUCIDE" && /Lucide|LUCIDE/.test(identifier)
    ? identifier.replace(/Lucide/g, "Vadivam").replace(/LUCIDE/g, "VADIVAM")
    : identifier;

// The text up to the end of the last import statement, and the rest.
function splitImports(text) {
  let end = 0;
  for (const match of text.matchAll(/\bimport\b[^;]*?\bfrom\s*["'][^"']+["'];?/g)) end = match.index + match[0].length;
  return [text.slice(0, end), text.slice(end)];
}

/**
 * Rewrite one source file. Returns the new text, how many edits it made, and
 * warnings for anything left to migrate by hand.
 */
export function migrateSource(text, { styles = false } = {}) {
  const warnings = [];
  let changes = 0;
  if (styles) {
    // Lucide renders `lucide lucide-<name>` classes; Vadivam renders `vadivam vadivam-<name>`.
    const output = text.replace(/\.lucide(?=[\s.,:#[>+~{)-]|$)/g, () => {
      changes += 1;
      return ".vadivam";
    });
    return { text: output, changes, warnings };
  }
  let migrated = false;
  let output = text.replace(specifierPattern, (match, prefix, quote, specifier) => {
    const mapped = mapSpecifier(specifier);
    if (!mapped) return match;
    if (mapped.manual) {
      warnings.push(mapped.manual);
      return match;
    }
    migrated = true;
    changes += 1;
    return `${prefix}${quote}${mapped.specifier}${quote}`;
  });
  if (migrated) {
    // LucideArrowRight, LucideProps, createLucideIcon, LucideProvider, ...
    output = output.replace(lucideIdentifierPattern, (identifier) => {
      const renamed = renameIdentifier(identifier);
      if (renamed !== identifier) changes += 1;
      return renamed;
    });
    // Deprecated Lucide names move to the canonical name: in the import, and in
    // the file's uses when the import is not renamed with `as`.
    const renames = new Map();
    output = output.replace(namedImportPattern, (statement, names) =>
      statement.replace(names, (list) =>
        list.replace(/((?:type\s+)?)([\w$]+)(\s+as\s+[\w$]+)?/g, (entry, type, imported, local) => {
          const canonical = canonicalExport(imported);
          if (canonical === imported) return entry;
          changes += 1;
          if (!local) renames.set(imported, canonical);
          const keep = local && local.replace(/^\s+as\s+/, "") !== canonical ? local : "";
          return `${type}${canonical}${keep}`;
        }),
      ),
    );
    if (renames.size > 0) {
      const pattern = new RegExp(`(?<![\\w$.])(?:${[...renames.keys()].join("|")})(?![\\w$])`, "g");
      const [head, body] = splitImports(output);
      output = head + body.replace(pattern, (identifier) => {
        changes += 1;
        return renames.get(identifier);
      });
    }
  }
  // The core package's createIcons() reads data-vadivam instead of data-lucide.
  output = output.replace(/\bdata-lucide(?==)/g, () => {
    changes += 1;
    return "data-vadivam";
  });
  for (const [, names, packageName] of output.matchAll(namedImportPattern)) {
    if (packageName === "vadivam-angular") continue;
    for (const entry of names.split(",")) {
      const imported = entry.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]?.trim();
      if (!imported || iconExports.has(imported) || apiExports.has(imported)) continue;
      warnings.push(`${imported} from ${packageName}: not a Vadivam export; search https://vadivam.praveenjuge.com/?q=${encodeURIComponent(imported)}`);
    }
  }
  return { text: output, changes, warnings };
}

/** Rename Lucide dependencies in a package.json, keeping key order and formatting. */
export function migratePackageJson(text, version) {
  const manifest = JSON.parse(text);
  const warnings = [];
  let changes = 0;
  for (const field of dependencyFields) {
    const dependencies = manifest[field];
    if (!dependencies || typeof dependencies !== "object") continue;
    const entries = [];
    for (const [name, range] of Object.entries(dependencies)) {
      if (manualPackages[name]) warnings.push(`${field}.${name}: ${manualPackages[name]}`);
      const target = packageMap[name];
      if (!target) {
        entries.push([name, range]);
        continue;
      }
      changes += 1;
      if (!(target in dependencies) && !entries.some(([existing]) => existing === target)) {
        entries.push([target, `^${version}`]);
      }
    }
    manifest[field] = Object.fromEntries(entries);
  }
  if (changes === 0) return { text, changes, warnings };
  const indent = text.match(/^[ \t]+(?=")/m)?.[0] ?? "  ";
  return { text: `${JSON.stringify(manifest, null, indent)}${text.endsWith("\n") ? "\n" : ""}`, changes, warnings };
}

async function* walk(target) {
  const entries = await readdir(target, { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOTDIR") return null;
    throw error;
  });
  if (!entries) {
    yield target;
    return;
  }
  for (const entry of entries) {
    const entryPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      if (!skippedDirectories.has(entry.name)) yield* walk(entryPath);
    } else if (entry.isFile()) {
      yield entryPath;
    }
  }
}

/** Migrate every supported file under `targets`. Writes only when `write` is true. */
export async function migrateLucide(targets, { write = false, version }) {
  const files = [];
  for (const target of targets) {
    for await (const file of walk(target)) {
      const extension = path.extname(file);
      const isManifest = path.basename(file) === "package.json";
      if (!isManifest && !sourceExtensions.has(extension) && !styleExtensions.has(extension)) continue;
      const text = await readFile(file, "utf8");
      if (!/lucide/i.test(text)) continue;
      const result = isManifest
        ? migratePackageJson(text, version)
        : migrateSource(text, { styles: styleExtensions.has(extension) });
      if (result.changes === 0 && result.warnings.length === 0) continue;
      if (write && result.changes > 0) await writeFile(file, result.text);
      files.push({ file, changes: result.changes, warnings: result.warnings });
    }
  }
  return files;
}
