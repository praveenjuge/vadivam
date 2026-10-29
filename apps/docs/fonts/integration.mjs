// Serves the subset fonts in this folder, which scripts/subset-fonts.py writes
// along with fonts.json, in place of the Google Fonts files Blume would fetch
// for `theme.fonts`. Blume and Astro still generate everything around them:
// the CSS variables, the fallback faces (measured from the first core file,
// which has Google's metrics), the preload of the `latin` subset, and the
// fonts on Open Graph cards.
//
// Blume's local fonts can't declare `unicode-range` or keep a file out of the
// preloads, so this points Blume's family at a provider that returns the core
// faces, then registers the extended faces as a second entry with the same CSS
// variable, name, and provider, which Astro merges into one family. That entry
// has no fallbacks, so Astro doesn't generate the fallback faces twice.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const { families } = JSON.parse(
  readFileSync(new URL("./fonts.json", import.meta.url), "utf8")
);

const provider = {
  name: "vadivam-subsets",
  resolveFont: ({ familyName, options }) => ({
    fonts: families
      .find((family) => family.name === familyName)
      .faces.filter((face) => face.subset === options.subset)
      .flatMap((face) =>
        face.weights.map((weight) => ({
          src: [
            {
              url: fileURLToPath(new URL(face.src, import.meta.url)),
              format: "woff2",
            },
          ],
          weight,
          style: face.style,
          unicodeRange: face.unicodeRange,
          meta: { subset: face.subset },
        }))
      ),
  }),
};

export default function subsetFonts() {
  return {
    name: "vadivam-subset-fonts",
    hooks: {
      "astro:config:setup": ({ config, updateConfig }) => {
        const extended = families.map(({ cssVariable, name }) => {
          const family = config.fonts?.find(
            (font) => font.cssVariable === cssVariable
          );
          if (!family) {
            throw new Error(
              `apps/docs/fonts/fonts.json serves ${cssVariable}, which theme.fonts no longer configures.`
            );
          }
          // Astro has no hook to replace a configured family, so Blume's is
          // edited in place.
          Object.assign(family, { name, provider, options: { subset: "latin" } });
          return { ...family, options: { subset: "extended" }, fallbacks: [] };
        });
        updateConfig({ fonts: extended });
      },
    },
  };
}
