import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docs = path.join(root, "apps/docs");
const blume = path.join(docs, "node_modules/.bin/blume");

const child = Bun.spawn([blume, "audit", "--json"], {
  cwd: docs,
  stderr: "pipe",
  stdout: "pipe",
});
const [stderr, stdout, exitCode] = await Promise.all([
  new Response(child.stderr).text(),
  new Response(child.stdout).text(),
  child.exited,
]);

if (!stdout.trim()) {
  if (stderr) {
    process.stderr.write(stderr);
  }
  process.exit(exitCode || 1);
}

const report = JSON.parse(stdout);
const isChangelogRoute = (url) =>
  url === "/changelog" || url?.startsWith("/changelog/");
const isGeneratedChangelogWarning = ({ code, severity, url }) =>
  severity === "warning" &&
  isChangelogRoute(url) &&
  (code === "BLUME_AUDIT_ORPHAN_PAGE" ||
    (url === "/changelog" && code === "BLUME_AUDIT_OG_IMAGE_MISSING"));
const failures = report.diagnostics.filter((diagnostic) => {
  const { severity } = diagnostic;
  return (
    (severity === "error" || severity === "warning") &&
    !isGeneratedChangelogWarning(diagnostic)
  );
});

if (failures.length > 0) {
  for (const diagnostic of failures) {
    const location = diagnostic.url ? ` ${diagnostic.url}` : "";
    process.stderr.write(
      `${diagnostic.severity.toUpperCase()} ${diagnostic.code}${location}: ${diagnostic.message}\n`
    );
  }
  process.exit(1);
}

const accepted = report.diagnostics.filter(
  isGeneratedChangelogWarning
).length;
process.stdout.write(
  `Blume audit passed; accepted ${accepted} generated changelog warning${accepted === 1 ? "" : "s"}.\n`
);
