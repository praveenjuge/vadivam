import type { LucideIconRanking } from "./catalog";

export interface CatalogSummary {
  existingCount: number;
  matchedCount: number;
  remainingCount: number;
  lucideVersion: string;
  retrievedAt: string;
  source: string;
  ranking: string;
  currentPage: string;
}

export const TABS = ["create", "replace", "arrange", "rename", "audit", "library"] as const;

export type Tab = (typeof TABS)[number];

export interface PluginSettings {
  batchSize: number;
  columns: number;
  tab: Tab;
}

export interface PageStatus {
  name: string;
  iconFrames: number;
  hasLibrary: boolean;
  libraryIcons: number;
}

export interface IconAuditIssue {
  id: string;
  name: string;
  violations: string[];
}

export interface IconAuditSummary {
  checked: number;
  passed: number;
  failed: number;
  renamed: number;
  rounded: number;
}

// "format" and "deprecated" ideas are exact matches; the rest are guesses.
export type RenameReason =
  | "format"
  | "deprecated"
  | "reordered"
  | "tag"
  | "spelling"
  | "similar";

export const EXACT_RENAME_REASONS: ReadonlySet<RenameReason> = new Set([
  "format",
  "deprecated",
]);

// Replace limits: plenty for a full icon set while keeping one message reasonably small.
export const MAX_SVG_FILES = 2_000;
export const MAX_SVG_LENGTH = 100_000;

export interface SvgFile {
  name: string;
  svg: string;
}

export interface ReplacedIcon {
  id: string;
  name: string;
}

export interface SkippedSvg {
  file: string;
  reason: string;
}

export interface RenameSuggestion {
  id: string;
  name: string;
  ideas: Array<{ name: string; reason: RenameReason; taken: boolean }>;
}

export type PluginToUiMessage =
  | { type: "loading" }
  | { type: "settings"; settings: PluginSettings }
  | { type: "page"; page: PageStatus }
  | {
      type: "library-synced";
      count: number;
      created: boolean;
      added: number;
      retained: number;
    }
  | { type: "catalog"; summary: CatalogSummary; candidates: LucideIconRanking[] }
  | { type: "generated"; names: string[] }
  | { type: "arranged"; count: number; columns: number; rows: number }
  | { type: "replaced"; replaced: ReplacedIcon[]; skipped: SkippedSvg[] }
  | { type: "rename-ideas"; icons: RenameSuggestion[]; renamed: number }
  | {
      type: "audit";
      summary: IconAuditSummary;
      issues: IconAuditIssue[];
    }
  | { type: "error"; message: string };

export type UiToPluginMessage =
  | { type: "refresh" }
  | { type: "sync-library" }
  | { type: "set-count"; count: number }
  | { type: "set-columns"; columns: number }
  | { type: "set-tab"; tab: Tab }
  | { type: "generate"; count: number }
  | { type: "arrange"; columns?: number }
  | { type: "replace"; files: SvgFile[] }
  | { type: "suggest-names" }
  | { type: "rename"; renames: Array<{ id: string; name: string }> }
  | { type: "select"; id: string }
  | { type: "audit" };
