declare module "vadivam:icon-catalog" {
  // Tags are Lucide search terms; categories are display titles such as "Arrows".
  const icons: ReadonlyArray<{
    name: string;
    svg: string;
    solidSvg: string;
    tags: readonly string[];
    categories: readonly string[];
  }>;
  export default icons;
}
