import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  mapSpecifier,
  migratePackageJson,
  migrateSource,
} from "../packages/vadivam/dist/migrate-lucide.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "packages/vadivam/dist/cli.js");

describe("migrate-lucide", () => {
  test("maps each Lucide package and its subpaths", () => {
    expect(mapSpecifier("lucide-react")).toEqual({ specifier: "vadivam-react" });
    expect(mapSpecifier("@lucide/svelte")).toEqual({ specifier: "vadivam-svelte" });
    expect(mapSpecifier("lucide-vue-next")).toEqual({ specifier: "vadivam-vue" });
    expect(mapSpecifier("lucide")).toEqual({ specifier: "vadivam" });
    expect(mapSpecifier("lucide-react/dynamic")).toEqual({ specifier: "vadivam-react/dynamic" });
    expect(mapSpecifier("lucide-react/dist/esm/icons/arrow-right.js")).toEqual({ specifier: "vadivam-react/icons/arrow-right" });
    expect(mapSpecifier("@lucide/svelte/icons/bell")).toEqual({ specifier: "vadivam-svelte/icons/bell" });
    expect(mapSpecifier("lucide-reactive")).toBeNull();
    expect(mapSpecifier("react")).toBeNull();
    expect(mapSpecifier("lucide-angular").manual).toContain("directive");
    expect(mapSpecifier("lucide-react/icons/not-an-icon").manual).toContain("no \"not-an-icon\" icon");
  });

  test("rewrites imports and Lucide-prefixed identifiers", () => {
    const source = [
      `import { ArrowRight, LucideBell, createLucideIcon, type LucideProps } from "lucide-react";`,
      `import { DynamicIcon } from 'lucide-react/dynamic';`,
      `const Lazy = lazy(() => import("lucide-react/dist/esm/icons/bell"));`,
      `vi.mock("lucide-react");`,
      `export const Bell = (props: LucideProps) => <LucideBell {...props} />;`,
      `const label = "Lucide";`,
    ].join("\n");
    const { text, changes, warnings } = migrateSource(source);
    expect(text).toBe(
      [
        `import { ArrowRight, VadivamBell, createVadivamIcon, type VadivamProps } from "vadivam-react";`,
        `import { DynamicIcon } from 'vadivam-react/dynamic';`,
        `const Lazy = lazy(() => import("vadivam-react/icons/bell"));`,
        `vi.mock("vadivam-react");`,
        `export const Bell = (props: VadivamProps) => <VadivamBell {...props} />;`,
        `const label = "Lucide";`,
      ].join("\n"),
    );
    expect(changes).toBe(9);
    expect(warnings).toEqual([]);
  });

  test("imports deprecated Lucide aliases under their canonical names", () => {
    expect(mapSpecifier("lucide-react/dist/esm/icons/alert-circle")).toEqual({ specifier: "vadivam-react/icons/circle-alert" });
    const source = [
      `import { AlertCircle, AlertTriangleIcon, LucideAlarmCheck, Home as House } from "lucide-react";`,
      `export const Status = () => <><AlertCircle /><AlertTriangleIcon /><LucideAlarmCheck /><House /></>;`,
    ].join("\n");
    const { text, warnings } = migrateSource(source);
    expect(text).toBe(
      [
        `import { CircleAlert as AlertCircle, TriangleAlertIcon as AlertTriangleIcon, VadivamAlarmClockCheck as VadivamAlarmCheck, House } from "vadivam-react";`,
        `export const Status = () => <><AlertCircle /><AlertTriangleIcon /><VadivamAlarmCheck /><House /></>;`,
      ].join("\n"),
    );
    expect(warnings).toEqual([]);
  });

  test("leaves strings, JSX text, and other bindings untouched when renaming aliases", () => {
    const source = [
      `import { Home, House, Edit } from "lucide-react";`,
      `export const Nav = () => <a title="Edit" aria-label={t("Home")}><Home /> Home <House /><Edit /></a>;`,
    ].join("\n");
    const { text } = migrateSource(source);
    expect(text).toBe(
      [
        `import { House as Home, House, SquarePen as Edit } from "vadivam-react";`,
        `export const Nav = () => <a title="Edit" aria-label={t("Home")}><Home /> Home <House /><Edit /></a>;`,
      ].join("\n"),
    );
  });

  test("renames only bindings imported from Lucide", () => {
    const source = [
      `import { LucideBell } from "lucide-react";`,
      `import { LucideClient } from "@acme/lucide-client";`,
      `const client = new LucideClient();`,
      `export const Bell = () => <LucideBell aria-label="LucideBell" data-client={client.LucideBell} />;`,
    ].join("\n");
    expect(migrateSource(source).text).toBe(
      [
        `import { VadivamBell } from "vadivam-react";`,
        `import { LucideClient } from "@acme/lucide-client";`,
        `const client = new LucideClient();`,
        `export const Bell = () => <VadivamBell aria-label="LucideBell" data-client={client.LucideBell} />;`,
      ].join("\n"),
    );
  });

  test("leaves files without Lucide imports alone", () => {
    const source = `import { LucideLike } from "./local";\n`;
    expect(migrateSource(source)).toEqual({ text: source, changes: 0, warnings: [] });
  });

  test("moves the core package's data-lucide attributes to data-vadivam", () => {
    const { text } = migrateSource(`import { createIcons, icons } from "lucide";\ncreateIcons({ icons });\n<i data-lucide="menu"></i>`);
    expect(text).toBe(`import { createIcons, icons } from "vadivam";\ncreateIcons({ icons });\n<i data-vadivam="menu"></i>`);
  });

  test("warns about imports Vadivam does not export and hand migrations", () => {
    const { warnings } = migrateSource(`import { House, NotAnIcon } from "lucide-react";\nimport { LucideAngularModule } from "lucide-angular";`);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain("lucide-angular");
    expect(warnings[1]).toContain("NotAnIcon from vadivam-react");
  });

  test("renames .lucide CSS classes", () => {
    const { text, changes } = migrateSource(`.lucide { stroke-width: 1.5; }\n.lucide-arrow-right, .lucideish {}`, { styles: true });
    expect(text).toBe(`.vadivam { stroke-width: 1.5; }\n.vadivam-arrow-right, .lucideish {}`);
    expect(changes).toBe(2);
  });

  test("renames dependencies in place and keeps formatting", () => {
    const manifest = `{\n    "dependencies": {\n        "lucide-react": "^0.500.0",\n        "react": "^19.0.0"\n    },\n    "devDependencies": {\n        "lucide-angular": "^1.0.0"\n    }\n}\n`;
    const { text, changes, warnings } = migratePackageJson(manifest, "1.2.3");
    expect(text).toBe(`{\n    "dependencies": {\n        "vadivam-react": "^1.2.3",\n        "react": "^19.0.0"\n    },\n    "devDependencies": {\n        "lucide-angular": "^1.0.0"\n    }\n}\n`);
    expect(changes).toBe(1);
    expect(warnings[0]).toContain("lucide-angular");
    expect(migratePackageJson(`{"dependencies":{"lucide-react":"1","vadivam-react":"2"}}`, "3").text).toBe(
      `{\n  "dependencies": {\n    "vadivam-react": "2"\n  }\n}`,
    );
  });

  test("skips a package.json that is not valid JSON", () => {
    const broken = `{ "dependencies": { "lucide-react": "^1.0.0", } }`;
    const { text, changes, warnings } = migratePackageJson(broken, "1.2.3");
    expect(text).toBe(broken);
    expect(changes).toBe(0);
    expect(warnings[0]).toStartWith("not valid JSON, skipped:");
  });

  test("the CLI lists changes without --write and applies them with it", async () => {
    const project = await mkdtemp(path.join(tmpdir(), "vadivam-migrate-"));
    try {
      await mkdir(path.join(project, "src"));
      await mkdir(path.join(project, "node_modules/lucide-react"), { recursive: true });
      const app = `import { Bell } from "lucide-react";\n`;
      await writeFile(path.join(project, "src/app.tsx"), app);
      await writeFile(path.join(project, "node_modules/lucide-react/index.js"), app);
      await writeFile(path.join(project, "package.json"), `{\n  "dependencies": {\n    "lucide-react": "^1.0.0"\n  }\n}\n`);

      const dryRun = spawnSync(process.execPath, [cli, "migrate-lucide"], { cwd: project, encoding: "utf8" });
      expect(dryRun.status).toBe(0);
      expect(dryRun.stdout).toContain(`would update ${path.join("src", "app.tsx")} (1 change)`);
      expect(dryRun.stdout).toContain("Run again with --write");
      expect(await readFile(path.join(project, "src/app.tsx"), "utf8")).toBe(app);

      const applied = spawnSync(process.execPath, [cli, "migrate-lucide", ".", "--write"], { cwd: project, encoding: "utf8" });
      expect(applied.status).toBe(0);
      expect(applied.stdout).toContain("2 files updated");
      expect(await readFile(path.join(project, "src/app.tsx"), "utf8")).toBe(`import { Bell } from "vadivam-react";\n`);
      expect(await readFile(path.join(project, "package.json"), "utf8")).toContain(`"vadivam-react": "^`);
      expect(await readFile(path.join(project, "node_modules/lucide-react/index.js"), "utf8")).toBe(app);

      const unknown = spawnSync(process.execPath, [cli, "nope"], { encoding: "utf8" });
      expect(unknown.status).toBe(1);
      expect(unknown.stdout).toContain("npx vadivam migrate-lucide");
    } finally {
      await rm(project, { recursive: true, force: true });
    }
  });
});
