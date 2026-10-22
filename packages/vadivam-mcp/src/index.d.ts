import type { CreateMcpHandlerOptions, McpHttpHandler, McpServer } from "@modelcontextprotocol/server";

export type IconFormat =
  | "svg"
  | "jsx"
  | "react"
  | "react-native"
  | "vue"
  | "svelte"
  | "solid"
  | "preact"
  | "astro"
  | "angular"
  | "data-uri"
  | "base64"
  | "css-mask"
  | "cdn"
  | "sprite"
  | "font"
  | "iconify"
  | "shadcn";

export type UsageFramework =
  | "core"
  | "react"
  | "react-native"
  | "vue"
  | "svelte"
  | "solid"
  | "preact"
  | "astro"
  | "angular";

export interface VadivamMcpIcon {
  name: string;
  componentName: string;
  tags: readonly string[];
  categories: readonly string[];
  svg: string;
}

export interface VadivamMcpCategory {
  id: string;
  title: string;
  description?: string;
}

export interface IconSummary {
  name: string;
  componentName: string;
  categories: string[];
  tags: string[];
  url: string;
}

export interface SearchResult {
  query: string;
  category?: string;
  total: number;
  results: IconSummary[];
}

export interface RenderOptions {
  size?: number;
  strokeWidth?: number;
  color?: string;
  absoluteStrokeWidth?: boolean;
}

export interface Usage {
  framework: UsageFramework;
  label: string;
  packageName: string;
  install: string;
  example: string;
  dynamic: string;
  docs: string;
}

/** The Vadivam release these icons ship with. */
export declare const version: string;
export declare const icons: readonly VadivamMcpIcon[];
export declare const categories: readonly VadivamMcpCategory[];
/** Instructions the server sends to clients when they connect. */
export declare const instructions: string;

/** A fresh MCP server with the search_icons, get_icon, list_categories, and get_usage tools. */
export declare function createVadivamServer(): McpServer;
/** A stateless Streamable HTTP handler with a web-standard `fetch(request)`. */
export declare function createVadivamHttpHandler(options?: CreateMcpHandlerOptions): McpHttpHandler;
export declare function searchIcons(
  query: string,
  options?: { limit?: number; category?: string },
): SearchResult;
export declare function findIcon(name: string): VadivamMcpIcon | undefined;
export declare function closestIconNames(name: string, limit?: number): string[];
export declare function renderIcon(
  icon: VadivamMcpIcon,
  format?: IconFormat,
  options?: RenderOptions,
): string;
export declare function usageFor(framework: UsageFramework): Usage;
