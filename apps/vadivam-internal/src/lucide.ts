import iconNames from "./data/lucide-icon-names.json";

export const lucideIconNames: readonly string[] = iconNames;

const iconNameSet = new Set(lucideIconNames);
const componentNameToIconName = new Map<string, string>();

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

export function resolveLucideIconName(value: string): string | null {
  const trimmed = value.trim();
  const canonical = trimmed.toLowerCase();
  if (iconNameSet.has(canonical)) return canonical;
  return componentNameToIconName.get(trimmed) ?? null;
}
