import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Blume's browser search client is built from this module, so exercising it
// here covers the code patched in patches/blume@*.patch.
const { buildOramaIndex, queryOramaIndex } = await import(
  path.join(root, "apps/docs/node_modules/blume/src/search/orama-index.ts")
);
const records = JSON.parse(
  readFileSync(path.join(root, "apps/docs/dist/client/blume-search.json"), "utf8"),
);

const { maximize } = Intl.Locale.prototype;
afterEach(() => {
  Intl.Locale.prototype.maximize = maximize;
});

test("docs search survives ICU rejecting Orama's tokenizer language", async () => {
  // Chromium 141 throws here for Orama's default language, which broke every
  // docs search until Blume's resolveLocale was patched to fall back.
  Intl.Locale.prototype.maximize = function () {
    if (this.language === "english") {
      throw new RangeError("Incorrect locale information provided");
    }
    return maximize.call(this);
  };

  const db = await buildOramaIndex(records);
  const hits = await queryOramaIndex(db, "installation", 5);
  expect(hits.map(({ route }) => route)).toContain("/docs/installation");
});
