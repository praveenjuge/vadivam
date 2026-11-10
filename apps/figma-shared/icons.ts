// What a Vadivam icon looks like on the Figma canvas, for both plugins.
import { canvasSize, iconSvg, styleIds, styles } from "../../scripts/icon-styles.mjs";
import { siteUrl } from "../../scripts/packages.mjs";

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

/** A component drawn from an icon; `tag` names and describes it, and a failure leaves nothing behind. */
export function createIconComponent(icon: CatalogIcon, style: IconStyle, tag: (component: ComponentNode) => void): ComponentNode {
  const frame = figma.createNodeFromSvg(catalogSvg(icon, style));
  try {
    const component = figma.createComponentFromNode(frame);
    tag(component);
    return component;
  } catch (error) {
    if (!frame.removed) frame.remove();
    throw error;
  }
}

/**
 * Moves the layers of `source`, a node made from an SVG, into `target` in
 * place of its own, then removes `source`. The node itself and its settings
 * stay; if a layer fails to move, `target` keeps its old layers.
 */
export function swapArtwork(target: ChildrenMixin, source: FrameNode): void {
  const oldChildren = [...target.children];
  const moved: SceneNode[] = [];
  try {
    for (const child of [...source.children]) {
      target.appendChild(child);
      moved.push(child);
    }
  } catch (error) {
    for (const child of moved) source.appendChild(child);
    source.remove();
    throw error;
  }
  for (const child of oldChildren) child.remove();
  source.remove();
}

export function documentationLink(iconName?: string): DocumentationLink {
  return { uri: iconName ? `${siteUrl}/icons/${encodeURIComponent(iconName)}` : siteUrl };
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
