import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { categories, icons, version } from "./data.js";
import {
  cdnUrl,
  componentSnippet,
  cssMaskSnippet,
  customizeSvg,
  fontSnippet,
  frameworks,
  frameworksById,
  iconifySnippet,
  shadcnAddCommand,
  siteUrl,
  spriteSnippet,
  svgBase64,
  svgDataUri,
  svgToJsx,
} from "./snippets.js";
import {
  closestIconNames,
  findIcon,
  iconSummary,
  searchIcons,
} from "./search.js";

export const instructions = `Vadivam is an open-source set of ${icons.length} pixel-perfect 24px outline icons (the Lucide icon names, redrawn) for SVG, React, React Native, Vue, Svelte, Solid, Preact, Astro, and Angular.
- Always call search_icons first to find a real icon name; never guess names. Search matches names, tags (synonyms), and categories.
- Prefer importing components from the framework package (get_usage, then get_icon with format set to the framework) over pasting raw SVG. Use format "svg" only when no package fits.
- Icon names are kebab-case (arrow-right); components are PascalCase (ArrowRight).
- Label meaningful icons (aria-label or title) and hide decorative ones (aria-hidden="true").
Docs: ${siteUrl}/docs`;

const formatIds = [
  "svg",
  "jsx",
  ...frameworks.map((framework) => framework.id),
  "data-uri",
  "base64",
  "css-mask",
  "cdn",
  "sprite",
  "font",
  "iconify",
  "shadcn",
];

const usageIds = ["core", ...frameworks.map((framework) => framework.id)];

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const iconSummarySchema = z.object({
  name: z.string(),
  componentName: z.string(),
  categories: z.array(z.string()),
  tags: z.array(z.string()),
  url: z.string(),
});

function installCommand(frameworkId) {
  if (frameworkId === "core") return "npm install vadivam";
  if (frameworkId === "react-native") return "npm install vadivam-react-native react-native-svg";
  return `npm install ${frameworksById[frameworkId].packageName}`;
}

function docsUrl(frameworkId) {
  return `${siteUrl}/docs/${frameworkId}`;
}

function textResult(text, structuredContent) {
  return { content: [{ type: "text", text }], structuredContent };
}

function errorResult(text) {
  return { content: [{ type: "text", text }], isError: true };
}

/** Code for one icon in one format, with any customization applied. */
export function renderIcon(icon, format = "svg", options = {}) {
  const svg = customizeSvg(icon.svg, options);
  if (frameworksById[format]) return componentSnippet(format, icon.componentName, options);
  switch (format) {
    case "svg":
      return svg.trim();
    case "jsx":
      return svgToJsx(svg);
    case "data-uri":
      return svgDataUri(svg);
    case "base64":
      return svgBase64(svg);
    case "css-mask":
      return cssMaskSnippet(icon.name, icon.svg);
    case "cdn":
      return cdnUrl(icon.name, version);
    case "sprite":
      return spriteSnippet(icon.name);
    case "font":
      return fontSnippet(icon.name);
    case "iconify":
      return iconifySnippet(icon.name);
    case "shadcn":
      return shadcnAddCommand(icon.name);
    default:
      throw new Error(`Unknown format "${format}". Use one of: ${formatIds.join(", ")}.`);
  }
}

function formatInstall(format) {
  if (frameworksById[format]) return installCommand(format);
  if (format === "sprite" || format === "font") return "npm install vadivam";
  return undefined;
}

/** Install command, import example, and docs link for one framework (or "core"). */
export function usageFor(frameworkId) {
  const framework = frameworksById[frameworkId];
  const packageName = framework?.packageName ?? "vadivam";
  const example = framework
    ? componentSnippet(frameworkId, "Activity", { size: 20 })
    : `import { Activity, createElement } from "vadivam";\nimport activitySvg from "vadivam/strings/activity";\n\nconst svg = createElement(Activity, { width: 20, height: 20, "aria-label": "Activity" });`;
  const dynamicImport =
    frameworkId === "svelte" || frameworkId === "astro"
      ? `import DynamicIcon from "${packageName}/dynamic"`
      : `import { DynamicIcon } from "${packageName}/dynamic"`;
  const dynamic = framework
    ? `${dynamicImport}${frameworkId === "angular" ? ' (directive: <svg vadivamDynamicIcon name="activity"></svg>)' : ""}. Validate runtime names against iconNames first. ${siteUrl}/docs/dynamic-icons`
    : `No DynamicIcon in vadivam; validate names with iconNames from "vadivam/manifest". ${siteUrl}/docs/dynamic-icons`;
  return {
    framework: frameworkId,
    label: framework?.label ?? "SVG and JavaScript",
    packageName,
    install: installCommand(frameworkId),
    example,
    dynamic,
    docs: docsUrl(frameworkId),
  };
}

/** A fresh MCP server with the Vadivam tools. Shared by the stdio CLI and the remote endpoint. */
export function createVadivamServer() {
  const server = new McpServer(
    {
      name: "vadivam",
      title: "Vadivam Icons",
      version,
      websiteUrl: siteUrl,
    },
    { instructions },
  );

  server.registerTool(
    "search_icons",
    {
      title: "Search icons",
      description:
        "Find Vadivam icons by name, synonym tag, or category. Ranked: exact name, then name prefix or word, then tag, then category. Call this before get_icon; never guess icon names.",
      inputSchema: z.object({
        query: z
          .string()
          .max(200)
          .describe("Words to match, such as \"arrow right\", \"delete\", or \"weather\". May be empty when category is set."),
        limit: z.number().int().min(1).max(100).optional().describe("Maximum results (default 20, max 100)."),
        category: z.string().max(100).optional().describe("Category id or title from list_categories, such as \"arrows\"."),
      }),
      outputSchema: z.object({
        query: z.string(),
        category: z.string().optional(),
        total: z.number(),
        results: z.array(iconSummarySchema),
      }),
      annotations: readOnly,
    },
    async ({ query, limit, category }) => {
      let result;
      try {
        result = searchIcons(query, { limit, category });
      } catch (error) {
        return errorResult(error.message);
      }
      const lines = result.results.map(
        (icon) =>
          `${icon.name} (${icon.componentName}) [${icon.categories.join(", ")}] tags: ${icon.tags.join(", ")}`,
      );
      const header =
        result.total === 0
          ? query.trim() === "" && !category
            ? "Pass a query, a category, or both."
            : `No icons match "${query}". Try a synonym or a broader word.`
          : `${result.total} match${result.total === 1 ? "" : "es"}${result.total > result.results.length ? `, showing ${result.results.length}` : ""}:`;
      return textResult([header, ...lines].join("\n"), result);
    },
  );

  server.registerTool(
    "get_icon",
    {
      title: "Get icon code",
      description:
        "Get one icon as SVG, JSX, a framework component snippet, a data URI, CSS mask, CDN URL, sprite, font, Iconify id, or shadcn command. Unknown names return the closest real names.",
      inputSchema: z.object({
        name: z.string().max(100).describe("Icon name from search_icons, such as \"arrow-right\" (PascalCase also works)."),
        format: z.enum(formatIds).optional().describe("Output format (default \"svg\"). Framework ids return an import snippet."),
        size: z.number().positive().max(1024).optional().describe("Width and height in pixels (default 24)."),
        strokeWidth: z.number().positive().max(24).optional().describe("Stroke width (default 2)."),
        color: z.string().max(64).optional().describe("Stroke color (default currentColor)."),
        absoluteStrokeWidth: z.boolean().optional().describe("Keep the stroke width constant when resizing."),
      }),
      outputSchema: z.object({
        name: z.string(),
        componentName: z.string(),
        format: z.string(),
        code: z.string(),
        install: z.string().optional(),
        url: z.string(),
      }),
      annotations: readOnly,
    },
    async ({ name, format = "svg", ...options }) => {
      const icon = findIcon(name);
      if (!icon) {
        const suggestions = closestIconNames(name, 5);
        return errorResult(
          `Unknown icon "${name}". Closest names: ${suggestions.join(", ")}. Use search_icons to find more.`,
        );
      }
      const code = renderIcon(icon, format, options);
      const install = formatInstall(format);
      const output = {
        name: icon.name,
        componentName: icon.componentName,
        format,
        code,
        ...(install ? { install } : {}),
        url: iconSummary(icon).url,
      };
      return textResult(install ? `${install}\n\n${code}` : code, output);
    },
  );

  server.registerTool(
    "list_categories",
    {
      title: "List categories",
      description: "List every icon category with its id, title, description, and icon count. Pass an id to search_icons as category.",
      inputSchema: z.object({}),
      outputSchema: z.object({
        categories: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            description: z.string().optional(),
            iconCount: z.number(),
          }),
        ),
      }),
      annotations: readOnly,
    },
    async () => {
      const list = categories.map((category) => ({
        ...category,
        iconCount: icons.filter((icon) => icon.categories.includes(category.id)).length,
      }));
      return textResult(
        list.map((category) => `${category.id}: ${category.title} (${category.iconCount})`).join("\n"),
        { categories: list },
      );
    },
  );

  server.registerTool(
    "get_usage",
    {
      title: "Get framework usage",
      description: "Install command, import example, dynamic icon API, and docs link for a framework package, or \"core\" for raw SVG and JavaScript.",
      inputSchema: z.object({
        framework: z.enum(usageIds).describe("Framework id, or \"core\" for the vadivam SVG package."),
      }),
      outputSchema: z.object({
        framework: z.string(),
        label: z.string(),
        packageName: z.string(),
        install: z.string(),
        example: z.string(),
        dynamic: z.string(),
        docs: z.string(),
      }),
      annotations: readOnly,
    },
    async ({ framework }) => {
      const usage = usageFor(framework);
      return textResult(
        `${usage.label} (${usage.packageName})\n\n${usage.install}\n\n${usage.example}\n\nDynamic names: ${usage.dynamic}\nDocs: ${usage.docs}`,
        usage,
      );
    },
  );

  return server;
}
