import type { PopularIcon } from "./catalog";

export interface CatalogSummary {
  existingCount: number;
  matchedCount: number;
  remainingCount: number;
  scannedAt: string | null;
  methodology: string | null;
  currentPage: string;
}

export interface IconAuditIssue {
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

export type PluginToUiMessage =
  | { type: "loading" }
  | { type: "library-status"; count: number; available: boolean }
  | {
      type: "library-synced";
      count: number;
      created: boolean;
      added: number;
      retained: number;
    }
  | { type: "catalog"; summary: CatalogSummary; candidates: PopularIcon[] }
  | { type: "generated"; names: string[] }
  | { type: "arranged"; count: number }
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
  | { type: "generate"; count: number }
  | { type: "arrange" }
  | { type: "audit" };
