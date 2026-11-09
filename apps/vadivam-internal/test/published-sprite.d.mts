import type { IconStyle } from "../../figma-shared/icons";

export declare function canonicalIcons(style: IconStyle): Promise<Array<{ name: string; svg: string }>>;
export declare function publishedSprite(style: IconStyle): Promise<string>;
