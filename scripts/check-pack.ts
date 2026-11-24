// Packs every package, installs the tarballs into a scratch project, then type-checks and bundles a
// usage sample against them: what a user installing from npm gets (`npm run check:pack`).
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "vite";

const root = resolve(import.meta.dirname, "..");
const packages = ["packages/core", "packages/vanilla"];
/** What a tarball must hold, and what it may. */
const REQUIRED = ["package.json", "LICENSE", "README.md", "dist/index.js", "dist/index.d.ts"];
const ALLOWED = /^(package\.json|LICENSE|README\.md|dist\/[\w-]+\.(js|d\.ts))$/;

const run = (command: string, args: string[], cwd: string) =>
  execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });

const scratch = mkdtempSync(join(tmpdir(), "curvesel-pack-"));
try {
  const packed: { filename: string; files: { path: string }[] }[] = JSON.parse(
    run(
      "npm",
      ["pack", "--json", "--pack-destination", scratch, ...packages.flatMap((p) => ["-w", p])],
      root,
    ),
  );
  for (const { filename, files } of packed) {
    const paths = files.map((file) => file.path);
    const missing = REQUIRED.filter((path) => !paths.includes(path));
    const stray = paths.filter((path) => !ALLOWED.test(path));
    if (missing.length || stray.length) {
      throw new Error(
        `${filename}: missing ${missing.join(", ") || "nothing"}; stray ${stray.join(", ") || "nothing"}`,
      );
    }
  }
  writeFileSync(join(scratch, "package.json"), JSON.stringify({ type: "module", private: true }));
  run(
    "npm",
    ["install", "--no-audit", "--no-fund", ...packed.map((p) => `./${p.filename}`)],
    scratch,
  );
  writeFileSync(
    join(scratch, "sample.ts"),
    readFileSync(join(root, "scripts/check-pack.sample.ts"), "utf8"),
  );
  writeFileSync(
    join(scratch, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        module: "nodenext",
        target: "es2024",
        noEmit: true,
        lib: ["es2024", "dom"],
      },
      files: ["sample.ts"],
    }),
  );
  run(join(root, "node_modules/.bin/tsc"), ["-p", "tsconfig.json"], scratch);
  await build({
    root: scratch,
    logLevel: "error",
    build: { lib: { entry: "sample.ts", formats: ["es"], fileName: "sample" }, outDir: "out" },
  });
  console.log(
    `check:pack: ${packed.map((p) => p.filename).join(", ")} install, type-check and bundle`,
  );
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
