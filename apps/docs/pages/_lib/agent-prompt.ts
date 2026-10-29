// The setup prompt the homepage copies for coding agents. It names every way
// to use Vadivam so an agent can pick the one that fits the project, and points
// at the skill and MCP server so it searches icons instead of guessing names.
import { frameworks, siteUrl } from "../../../../scripts/snippets.mjs";

const packageLines = frameworks.map(({ id, label, packageName, registry }) =>
  id === "react-native"
    ? `   - ${label} or Expo: ${packageName} and react-native-svg`
    : registry === "pub"
      ? `   - ${label}: ${packageName} from pub.dev`
      : registry === "maven"
        ? `   - Jetpack ${label}: ${packageName} from Maven Central`
        : `   - ${label}: ${packageName}`,
);

export const agentPrompt = `Set up Vadivam icons in this project (${siteUrl}).

Vadivam is an open-source set of pixel-perfect 24px outline icons. Icon names and component APIs match Lucide. Read ${siteUrl}/skill.md first and follow it.

1. Check the project manifest (package.json, pubspec.yaml, or build.gradle) and install only the package that matches this project:
${packageLines.join("\n")}
   - Anything else, including plain HTML and htmx: vadivam (SVG files, SVG strings, a sprite, an icon font, JavaScript helpers, and the \`<vadivam-icon>\` element from vadivam/elements)
2. If the project uses Lucide, preview the switch with \`npx vadivam migrate-lucide\`, then apply it with \`npx vadivam migrate-lucide --write\`.
3. If the project uses shadcn/ui and needs only a few icons, add each one as a local component instead: \`npx shadcn@latest add ${siteUrl}/r/<icon-name>.json\`.
4. Connect the Vadivam MCP server so you can search icons instead of guessing names. Hosted: ${siteUrl}/mcp (Streamable HTTP, no API key). Local: \`npx -y vadivam-mcp\`. In Claude Code: \`claude mcp add --transport http vadivam ${siteUrl}/mcp\`.
5. If the project already uses Iconify or unplugin-icons, use the \`vadivam\` prefix, such as \`vadivam:arrow-right\`.

Rules:
- Never guess an icon name. Search with the MCP \`search_icons\` tool or the \`vadivam/manifest\` export.
- Import icons by name so unused icons are tree-shaken, such as \`import { ArrowRight } from "vadivam-react"\`.
- Add aria-hidden="true" to decorative icons, and give icons that carry meaning an accessible label.

Every docs page: ${siteUrl}/llms.txt
`;
