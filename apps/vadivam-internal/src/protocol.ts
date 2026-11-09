import type { LucideIconRanking } from "./lucide";
import type { RemoteFailure, RemoteSource } from "./remote";
import type { PluginSettings, Tab } from "./settings";

export interface CatalogProgress {
  lucideVersion: string;
  /** Current Lucide icons with a frame in the file, on pages of the current style. */
  drawn: number;
  /** Current Lucide icons with no frame yet. */
  remaining: number;
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
export type RenameReason = "format" | "deprecated" | "reordered" | "tag" | "spelling" | "similar";

export const EXACT_RENAME_REASONS: ReadonlySet<RenameReason> = new Set(["format", "deprecated"]);

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
  | { type: "library-synced"; count: number; created: boolean; added: number; retained: number }
  | { type: "catalog"; progress: CatalogProgress; candidates: LucideIconRanking[] }
  | { type: "generated"; names: string[] }
  | { type: "arranged"; count: number; columns: number; rows: number }
  | { type: "replaced"; replaced: ReplacedIcon[]; added: ReplacedIcon[]; skipped: SkippedSvg[] }
  | { type: "rename-ideas"; icons: RenameSuggestion[]; renamed: number }
  | { type: "audit"; summary: IconAuditSummary; issues: IconAuditIssue[] }
  | { type: "remote-checked"; source: RemoteSource; version: string; missing: string[] }
  | { type: "remote-added"; version: string; added: string[]; failed: RemoteFailure[] }
  | { type: "error"; message: string };

export type UiToPluginMessage =
  | { type: "refresh" }
  | { type: "sync-library" }
  | { type: "set-count"; count: number }
  | { type: "set-columns"; columns: number }
  | { type: "set-tab"; tab: Tab }
  | { type: "generate"; count: number }
  | { type: "arrange"; columns: number }
  | { type: "replace"; files: SvgFile[] }
  | { type: "suggest-names" }
  | { type: "rename"; renames: Array<{ id: string; name: string }> }
  | { type: "select"; id: string }
  | { type: "audit" }
  | { type: "check-remote"; source: RemoteSource }
  | { type: "add-remote"; source: RemoteSource };
