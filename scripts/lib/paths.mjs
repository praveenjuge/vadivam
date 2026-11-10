// Where things are in the repository, for the scripts. Imports nothing but
// Node's path helpers, so any script can read a path without loading the icons.
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// The Lucide data for the pinned release, relative to the repository root.
export const metadataFiles = Object.freeze({
  lucide: "metadata/lucide.json",
  aliases: "metadata/lucide-aliases.json",
  rankings: "metadata/lucide-rankings.json",
  solidHints: "metadata/solid-hints.json",
});

// What the docs site serves as it is; the build writes its generated assets here.
export const docsPublicDirectory = path.join(root, "apps/docs/public");
export const shadcnRegistryDirectory = path.join(docsPublicDirectory, "r");
