// One generator per package in scripts/packages.mjs, keyed by its id. Each
// module exports `build`; the ones the migrate-lucide codemod covers also
// export `apiExports`, the names the package exports besides its icons, and
// may export `iconExportAliases` when icons aren't exported under the usual
// aliases.
import { targets } from "../packages.mjs";
import * as angular from "./angular.mjs";
import * as astro from "./astro.mjs";
import * as compose from "./compose.mjs";
import * as flutter from "./flutter.mjs";
import * as lit from "./lit.mjs";
import * as mcp from "./mcp.mjs";
import * as preact from "./preact.mjs";
import * as qwik from "./qwik.mjs";
import * as reactNative from "./react-native.mjs";
import * as react from "./react.mjs";
import { iconAliases } from "./shared.mjs";
import * as solid from "./solid.mjs";
import * as svelte from "./svelte.mjs";
import * as core from "./vadivam.mjs";
import * as vue from "./vue.mjs";

export const generators = Object.freeze({
  core,
  react,
  "react-native": reactNative,
  vue,
  svelte,
  solid,
  preact,
  astro,
  angular,
  qwik,
  lit,
  flutter,
  compose,
  mcp,
});

/** Throws unless the packages and the generators are the same set, and the codemod knows every package it maps to. */
export function assertGeneratorsMatchPackages(list = targets, registry = generators) {
  const ids = new Set(list.map((target) => target.id));
  const problems = [
    ...list.filter((target) => !registry[target.id]?.build).map((target) => `no generator for ${target.id}`),
    ...Object.keys(registry).filter((id) => !ids.has(id)).map((id) => `no package for the ${id} generator`),
    ...list
      .filter((target) => (target.lucide || target.lucideManual) && !registry[target.id]?.apiExports)
      .map((target) => `the ${target.id} generator exports no apiExports for migrate-lucide`),
  ];
  if (problems.length) throw new Error(`scripts/generators/index.mjs and scripts/packages.mjs disagree: ${problems.join("; ")}`);
}

/** Each package's non-icon exports and icon aliases by target id, for the generators that declare them. */
export const packageApis = Object.freeze(
  Object.fromEntries(
    Object.entries(generators)
      .filter(([, generator]) => generator.apiExports)
      .map(([id, generator]) => [id, { names: generator.apiExports, iconAliases: generator.iconExportAliases ?? iconAliases }]),
  ),
);
