const LICENSE = "https://opensource.org/licenses/MIT";
const REPOSITORY = "https://github.com/praveenjuge/vadivam";
const NPM = "https://www.npmjs.com/package/vadivam";

export const OG_IMAGE = "/og.png";
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

export type CatalogIcon = {
  name: string;
  componentName: string;
  fileName: string;
  svg?: string;
};

export function humanizeIconName(name: string): string {
  return name.replaceAll("-", " ");
}

export function ogImageAlt(iconCount: number): string {
  return `Vadivam — ${iconCount} free 24px outline icons`;
}

export function iconPageTitle(componentName: string): string {
  return `${componentName} icon — Vadivam`;
}

const DESCRIPTION_MIN = 110;
const DESCRIPTION_MAX = 155;

export function iconPageDescription(icon: CatalogIcon): string {
  const words = humanizeIconName(icon.name);
  const options = [
    `${icon.componentName} (${icon.name}) is a free, open-source 24px outline ${words} icon from Vadivam. Download the SVG or use it in React, Vue, and more.`,
    `${icon.componentName} (${icon.name}) is a free 24px outline ${words} icon from Vadivam. Download the SVG or use it in React.`,
    `${icon.componentName} (${icon.name}) is a free 24px outline icon from Vadivam. Download the SVG or use it in React.`,
  ];
  const inRange = options.find(
    (text) => text.length >= DESCRIPTION_MIN && text.length <= DESCRIPTION_MAX,
  );
  if (inRange) return inRange;

  const shortEnough = options.find((text) => text.length <= DESCRIPTION_MAX);
  if (shortEnough) {
    const pad = " MIT licensed.";
    return shortEnough.length + pad.length <= DESCRIPTION_MAX &&
      shortEnough.length < DESCRIPTION_MIN
      ? `${shortEnough}${pad}`
      : shortEnough;
  }

  return `${icon.componentName} (${icon.name}) is a free 24px outline icon from Vadivam.`;
}

export function relatedIcons(
  icon: CatalogIcon,
  icons: readonly CatalogIcon[],
  limit = 8,
): CatalogIcon[] {
  const tokens = icon.name.split("-");
  const prefix = tokens[0];
  const scored: { icon: CatalogIcon; score: number }[] = [];

  for (const other of icons) {
    if (other.name === icon.name) continue;
    const otherTokens = other.name.split("-");
    let score = 0;
    if (otherTokens[0] === prefix) score += 3;
    for (const token of otherTokens) {
      if (tokens.includes(token)) score += 1;
    }
    if (score > 0) scored.push({ icon: other, score });
  }

  scored.sort(
    (a, b) => b.score - a.score || a.icon.name.localeCompare(b.icon.name),
  );
  const picked: CatalogIcon[] = scored.slice(0, limit).map((entry) => entry.icon);
  if (picked.length >= Math.min(3, limit)) return picked.slice(0, limit);

  const index = icons.findIndex((item) => item.name === icon.name);
  const seen = new Set(picked.map((item) => item.name));
  for (let offset = 1; picked.length < limit && offset <= icons.length; offset += 1) {
    const before = index - offset;
    const after = index + offset;
    if (before >= 0 && !seen.has(icons[before].name)) {
      picked.push(icons[before]);
      seen.add(icons[before].name);
    }
    if (picked.length >= limit) break;
    if (after < icons.length && !seen.has(icons[after].name)) {
      picked.push(icons[after]);
      seen.add(icons[after].name);
    }
  }
  return picked;
}

export function softwareApplicationNode(site: string, description: string) {
  return {
    "@type": ["SoftwareApplication", "SoftwareSourceCode"],
    "@id": `${site}#software`,
    name: "Vadivam",
    alternateName: "Vadivam Icons",
    description,
    url: `${site}/`,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any",
    license: LICENSE,
    codeRepository: REPOSITORY,
    downloadUrl: NPM,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
}

export function websiteNode(site: string, title: string, description: string) {
  return {
    "@type": "WebSite",
    "@id": `${site}#website`,
    name: title,
    url: `${site}/`,
    description,
    publisher: { "@id": `${site}#software` },
  };
}

export function iconStructuredData({
  site,
  siteTitle,
  siteDescription,
  icon,
  pageTitle,
  pageDescription,
}: {
  site: string;
  siteTitle: string;
  siteDescription: string;
  icon: CatalogIcon;
  pageTitle: string;
  pageDescription: string;
}) {
  const iconUrl = `${site}/icons/${icon.name}`;
  const imageUrl = `${site}/icons/${icon.fileName}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      websiteNode(site, siteTitle, siteDescription),
      softwareApplicationNode(site, siteDescription),
      {
        "@type": "WebPage",
        "@id": `${iconUrl}#page`,
        name: pageTitle,
        description: pageDescription,
        url: iconUrl,
        isPartOf: { "@id": `${site}#website` },
        about: { "@id": `${iconUrl}#image` },
      },
      {
        "@type": "ImageObject",
        "@id": `${iconUrl}#image`,
        name: `${icon.componentName} icon`,
        description: pageDescription,
        contentUrl: imageUrl,
        encodingFormat: "image/svg+xml",
        width: 24,
        height: 24,
        license: LICENSE,
        isPartOf: { "@id": `${site}#software` },
        keywords: `${icon.name}, ${icon.componentName}, vadivam, svg icon, outline icon, 24px icon`,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Icons", item: `${site}/` },
          { "@type": "ListItem", position: 2, name: `${icon.componentName} icon`, item: iconUrl },
        ],
      },
    ],
  };
}

export function homeStructuredData(site: string, title: string, description: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [websiteNode(site, title, description), softwareApplicationNode(site, description)],
  };
}
