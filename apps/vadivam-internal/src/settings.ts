// Per-user settings, saved with figma.clientStorage. The UI's inputs and the
// main thread's checks both read their limits from here.

export const TABS = ["create", "replace", "arrange", "rename", "audit", "library"] as const;

export type Tab = (typeof TABS)[number];

export function isTab(value: unknown): value is Tab {
  return (TABS as readonly unknown[]).includes(value);
}

export const COUNT_LIMITS = {
  /** Frames Create makes at once. */
  batchSize: { label: "Batch size", initial: 20, max: 100 },
  /** Icons per row in Arrange and for new frames. */
  columns: { label: "Columns", initial: 40, max: 100 },
} as const;

export type CountSetting = keyof typeof COUNT_LIMITS;

export interface PluginSettings extends Record<CountSetting, number> {
  tab: Tab;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  batchSize: COUNT_LIMITS.batchSize.initial,
  columns: COUNT_LIMITS.columns.initial,
  tab: "create",
};

/** A whole number brought into the setting's range, or null for anything else. */
export function clampCount(setting: CountSetting, value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  return Math.min(COUNT_LIMITS[setting].max, Math.max(1, value));
}
