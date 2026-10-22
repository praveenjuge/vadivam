declare module "vadivam:catalog" {
  /** The `<svg …>` opening tag every icon shares; wrap `body` in it to get the full SVG. */
  export const svgRoot: string;
  /** Deprecated Lucide icon names mapped to the current Vadivam name. */
  export const lucideAliases: Readonly<Record<string, string>>;
  // Categories are display titles such as "Arrows"; tags are Lucide search terms.
  const icons: ReadonlyArray<{
    name: string;
    body: string;
    tags: readonly string[];
    categories: readonly string[];
  }>;
  export default icons;
}

declare module "vadivam:ui-catalog" {
  const index: {
    /** [id, title] pairs in display order. */
    categories: ReadonlyArray<readonly [string, string]>;
    /** [name, tags, category ids], sorted by name. */
    icons: ReadonlyArray<readonly [string, readonly string[], readonly string[]]>;
  };
  export default index;
}
