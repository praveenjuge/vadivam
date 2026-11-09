// What a Vadivam icon looks like on the Figma canvas, for both plugins.
import { canvasSize, iconSvg, styleIds, styles } from "../../scripts/icon-styles.mjs";

export type IconStyle = keyof typeof styles;

export const iconStyles = styleIds as readonly IconStyle[];

export function isIconStyle(value: unknown): value is IconStyle {
  return (iconStyles as readonly unknown[]).includes(value);
}

export interface CatalogIcon {
  name: string;
  /** Lucide search terms. */
  tags: readonly string[];
  /** Category titles such as "Arrows". */
  categories: readonly string[];
  /** The markup inside each style's root element. */
  bodies: Readonly<Record<IconStyle, string>>;
}

export function catalogSvg(icon: CatalogIcon, style: IconStyle): string {
  return iconSvg(styles[style], icon.bodies[style]);
}

const SITE_URL = "https://vadivam.praveenjuge.com";

export function documentationLink(iconName?: string): DocumentationLink {
  return { uri: iconName ? `${SITE_URL}/icons/${encodeURIComponent(iconName)}` : SITE_URL };
}

export const svgExportSettings: ExportSettingsSVG = {
  format: "SVG",
  suffix: "",
  contentsOnly: true,
  svgOutlineText: true,
  svgIdAttribute: false,
  svgSimplifyStroke: true,
  colorProfile: "DOCUMENT",
};

// Category titles and tags stay plain words, so Figma's asset search finds the
// component by them.
export function describeIconComponent(component: ComponentNode, icon: CatalogIcon, style: IconStyle): void {
  component.descriptionMarkdown = [
    `${canvasSize} px ${style} icon from Vadivam.`,
    icon.categories.length > 0 ? `**Categories:** ${icon.categories.join(", ")}` : "",
    icon.tags.length > 0 ? `**Tags:** ${icon.tags.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  component.documentationLinks = [documentationLink(icon.name)];
  component.exportSettings = [svgExportSettings];
}
