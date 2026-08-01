import iconNames from "./data/lucide-icon-names.json";
import deprecatedAliases from "./data/lucide-deprecated-aliases.json";

export const lucideIconNames: readonly string[] = iconNames;

const iconNameSet = new Set(lucideIconNames);
const componentNameToIconName = new Map<string, string>();
const deprecatedAliasToIconName = new Map<string, string>(
  Object.entries(deprecatedAliases),
);
const deprecatedComponentNameToIconName = new Map<string, string>();

function toComponentName(iconName: string): string {
  return iconName
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

for (const iconName of lucideIconNames) {
  const componentName = toComponentName(iconName);
  const collision = componentNameToIconName.get(componentName);
  if (collision && collision !== iconName) {
    throw new Error(`Ambiguous Lucide component name: ${componentName}`);
  }
  componentNameToIconName.set(componentName, iconName);
}

for (const [alias, iconName] of deprecatedAliasToIconName) {
  if (!iconNameSet.has(iconName)) {
    throw new Error(`Deprecated Lucide alias has an unknown replacement: ${alias}`);
  }
  const componentName = toComponentName(alias);
  const collision = deprecatedComponentNameToIconName.get(componentName);
  if (collision && collision !== iconName) {
    throw new Error(`Ambiguous deprecated Lucide component name: ${componentName}`);
  }
  deprecatedComponentNameToIconName.set(componentName, iconName);
}

export function resolveLucideIconName(value: string): string | null {
  const trimmed = value.trim();
  const canonical = trimmed.toLowerCase();
  if (iconNameSet.has(canonical)) return canonical;
  return componentNameToIconName.get(trimmed) ?? null;
}

export function getDeprecatedLucideReplacement(value: string): string | null {
  const trimmed = value.trim();
  return (
    deprecatedAliasToIconName.get(trimmed.toLowerCase()) ??
    deprecatedComponentNameToIconName.get(trimmed) ??
    null
  );
}

export function resolveLucideIconNameIncludingDeprecated(value: string): string | null {
  return resolveLucideIconName(value) ?? getDeprecatedLucideReplacement(value);
}
