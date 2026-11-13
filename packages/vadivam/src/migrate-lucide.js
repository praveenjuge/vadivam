import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { lucideAliases, lucideComponentAliases } from "./lucide-aliases.js";
import { icons } from "./manifest.js";
import { lucidePackages, manualLucidePackages, packageExports, siteUrl } from "./package-exports.js";

// Every Vadivam icon keeps its Lucide name, and each framework package mirrors
// the matching Lucide package's API with Lucide renamed to Vadivam. So moving
// over is a package rename plus `Lucide` -> `Vadivam` in imported identifiers.
// The package names come from scripts/packages.mjs, through package-exports.js.
export const packageMap = lucidePackages;

// Packages whose API differs enough that they need a hand migration.
const manualPackages = manualLucidePackages;

export const guideUrl = `${siteUrl}/docs/migrate-from-lucide`;

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
// Every name each package exports, from the lists its generator wrote.
const componentNames = icons.map((icon) => icon.componentName);
const exportsByPackage = new Map(
  Object.entries(packageExports).map(([packageName, { names, iconAliases }]) => [
    packageName,
    new Set([
      "default",
      ...names,
      ...iconAliases.flatMap(([prefix, suffix]) => componentNames.map((name) => `${prefix}${name}${suffix}`)),
    ]),
  ]),
);

const specifierPattern = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*|\.mock\s*\(\s*)(["'])([^"'\n]+)\2/g;
// Named bindings taken from a Vadivam package: imports, re-exports, and
// destructured require() calls. `separator` joins a name to its local name.
const bindingLists = [
  { kind: "import", separator: " as ", pattern: /\bimport\s+(?:type\s+)?(?:[\w$]+\s*,\s*)?\{([^}]*)\}\s*from\s*["'](vadivam(?:-[a-z-]+)?)(?:\/dynamic)?["']/g },
  { kind: "export", separator: " as ", pattern: /\bexport\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["'](vadivam(?:-[a-z-]+)?)(?:\/dynamic)?["']/g },
  { kind: "require", separator: ": ", pattern: /\b(?:const|let|var)\s*\{([^}]*)\}\s*=\s*require\s*\(\s*["'](vadivam(?:-[a-z-]+)?)(?:\/dynamic)?["']\s*\)/g },
];
const bindingEntry = /((?:type\s+)?)([\w$]+)(?:\s*(?:\bas\b|:)\s*([\w$]+))?/g;

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

/** The canonical export for a deprecated Lucide one: AlertCircleIcon -> CircleExclamationPointIcon. */
function canonicalExport(name) {
  const [, prefix, base, suffix] = name.match(/^(Vadivam)?(\w+?)(Icon)?$/) ?? [];
  const canonical = base && Object.prototype.hasOwnProperty.call(lucideComponentAliases, base) && lucideComponentAliases[base];
  return canonical ? `${prefix ?? ""}${canonical}${suffix ?? ""}` : name;
}

const renameIdentifier = (identifier) =>
  identifier !== "Lucide" && identifier !== "LUCIDE" && /Lucide|LUCIDE/.test(identifier)
    ? identifier.replace(/Lucide/g, "Vadivam").replace(/LUCIDE/g, "VADIVAM")
    : identifier;

// Whether the identifier at text[start, end) sits where a shorthand property
// would (`{ LucideBell }`, `{ a, LucideBell = X }`), where renaming it also
// renames the key. Telling an object from JSX or a template expression needs a
// parser, so this only flags it; a JSX attribute (`icon={LucideBell}`) and a
// template expression (`${LucideBell}`) are left out.
function looksLikeShorthand(text, start, end) {
  const before = text.slice(0, start).match(/([{,])\s*$/);
  if (!before || !/^\s*(?:[},]|=(?![=>]))/.test(text.slice(end))) return false;
  if (before[1] === ",") return true;
  return !/(?:[\w$-]=|\$)$/.test(text.slice(0, start - before[0].length));
}

/**
 * Rewrite one source file. Returns the new text, how many edits it made, and
 * warnings for anything left to migrate by hand.
 */
export function migrateSource(text, { styles = false } = {}) {
  const warnings = [];
  let changes = 0;
  // Lucide renders `lucide lucide-<name>` classes; Vadivam renders `vadivam vadivam-<name>`.
  const migrateCss = (css) =>
    css.replace(/\.lucide(?=[\s.,:#[>+~{)-]|$)/g, () => {
      changes += 1;
      return ".vadivam";
    });
  if (styles) return { text: migrateCss(text), changes, warnings };
  let migrated = false;
  // Vue, Svelte, Astro, and HTML files carry their own <style> blocks.
  let output = text.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (match, open, css, close) => `${open}${migrateCss(css)}${close}`);
  output = output.replace(specifierPattern, (match, prefix, quote, specifier) => {
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
    // Only names taken from Lucide are renamed. An imported `LucideBell` becomes
    // `VadivamBell` here and in the file's uses; a deprecated name imports the
    // canonical icon under the old local name (`House as Home`) so the file's
    // strings and JSX text stay as written. A re-export keeps its public name
    // (`VadivamBell as LucideBell`) so the module's importers keep working.
    const renames = new Map();
    for (const { kind, separator, pattern } of bindingLists) {
      output = output.replace(pattern, (statement, names) =>
        statement.replace(names, (list) =>
          list.replace(bindingEntry, (entry, type, imported, local) => {
            const binding = local ?? (kind === "export" ? imported : renameIdentifier(imported));
            const exported = canonicalExport(renameIdentifier(imported));
            if (!local && binding !== imported) renames.set(imported, binding);
            const next = `${type}${exported}${binding === exported ? "" : `${separator}${binding}`}`;
            if (next !== entry) changes += 1;
            return next;
          }),
        ),
      );
    }
    if (renames.size > 0) {
      const shorthands = new Set();
      // Rewritten import and export statements, quoted strings, and object or
      // destructuring keys (`{ LucideBell: x }`) stay as they are. A local
      // `export { LucideBell }` keeps its public name (`VadivamBell as
      // LucideBell`); other identifier uses, but not property reads, take the
      // new name.
      output = output.replace(
        /\bimport\s+(?:type\s+)?(?:[\w$]+\s*,?\s*)?(?:\*\s+as\s+[\w$]+|\{[^}]*\})?\s*from\s*["'][^"']*["']|\bexport\s+(?:type\s+)?(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s*from\s*["'][^"']*["']|\bexport\s*(?:type\s*)?\{([^}]*)\}|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|(?<=[{,]\s*)[A-Za-z_$][\w$]*(?=\s*:(?!:))|(?<![\w$.])([A-Za-z_$][\w$]*)/g,
        (match, exportList, identifier, offset, source) => {
          if (exportList !== undefined) {
            return match.replace(exportList, (list) =>
              list.replace(/([\w$]+)(\s+as\s+[\w$]+)?/g, (entry, name, alias) => {
                const renamed = renames.get(name);
                if (!renamed) return entry;
                changes += 1;
                return `${renamed}${alias ?? ` as ${name}`}`;
              }),
            );
          }
          const renamed = identifier && renames.get(identifier);
          if (!renamed) return match;
          changes += 1;
          if (looksLikeShorthand(source, offset, offset + match.length)) {
            const line = source.slice(0, offset).split("\n").length;
            shorthands.add(`line ${line}: { ${match} } is now { ${renamed} }; if ${match} is an object key, write { ${match}: ${renamed} }`);
          }
          return renamed;
        },
      );
      warnings.push(...shorthands);
    }
    // A mock factory lists the module's export names, which this can't safely rewrite.
    if (/\.mock\s*\(\s*["']vadivam[^"']*["']\s*,/.test(output)) {
      warnings.push("a test mock factory for a Vadivam package: check that its keys use Vadivam export names");
    }
  }
  // The core package's createIcons() reads data-vadivam instead of data-lucide,
  // and only knows current names (`home` is `house`).
  output = output.replace(/\bdata-lucide=(?:(["'])([a-z0-9-]+)\1)?/g, (match, quote, name) => {
    changes += 1;
    return name ? `data-vadivam=${quote}${lucideAliases[name] ?? name}${quote}` : "data-vadivam=";
  });
  for (const { pattern } of bindingLists) {
    for (const [, names, packageName] of output.matchAll(pattern)) {
      const exported = exportsByPackage.get(packageName);
      if (!exported) continue;
      for (const [, , imported] of names.matchAll(bindingEntry)) {
        if (exported.has(imported)) continue;
        warnings.push(`${imported} from ${packageName}: not a Vadivam export; search ${siteUrl}/?q=${encodeURIComponent(imported)}`);
      }
    }
  }
  return { text: output, changes, warnings };
}

/** Rename Lucide dependencies in a package.json, keeping key order and formatting. */
export function migratePackageJson(text, version) {
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch (error) {
    return { text, changes: 0, warnings: [`not valid JSON, skipped: ${error.message}`] };
  }
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
