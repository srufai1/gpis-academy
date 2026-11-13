/**
 * Packs the checker for a GitHub release (T17).
 *   node scripts/pack-checker.mjs   →  packages/checker/release/ruftech-academy-checker-<version>.tgz
 *
 * The package holds: bin/academy.mjs, dist/academy.mjs (one bundled file: the CLI, the shared
 * code, yaml and pg) and checks/ (only the check/ folders of content/). Lessons, quizzes and
 * answers are never in it. It has no dependencies to install.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const repo = fileURLToPath(new URL("..", import.meta.url));
const pkgDir = join(repo, "packages", "checker");
const stage = join(pkgDir, ".pack");
const out = join(pkgDir, "release");
const { version } = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
const source = readFileSync(join(pkgDir, "src", "version.ts"), "utf8");
if (!source.includes(`"${version}"`)) throw new Error(`src/version.ts and package.json disagree about the version (${version})`);

rmSync(stage, { recursive: true, force: true });
mkdirSync(join(stage, "dist"), { recursive: true });
mkdirSync(out, { recursive: true });

await build({
  entryPoints: [join(pkgDir, "src", "cli.ts")],
  outfile: join(stage, "dist", "academy.mjs"),
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  external: ["pg-native", "playwright"],
  banner: { js: "import { createRequire as __academyRequire } from 'node:module'; const require = __academyRequire(import.meta.url);" },
  legalComments: "none",
  logLevel: "warning",
});

// Only check/ folders, at the same paths as in content/.
const content = join(repo, "content");
const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const full = join(dir, name);
  if (!statSync(full).isDirectory()) return [];
  return name === "check" && existsSync(join(full, "check.yaml")) ? [full] : walk(full);
});
for (const dir of walk(content)) cpSync(dir, join(stage, "checks", relative(content, dir)), { recursive: true });

mkdirSync(join(stage, "bin"));
cpSync(join(pkgDir, "bin", "academy.mjs"), join(stage, "bin", "academy.mjs"));
writeFileSync(join(stage, "package.json"), `${JSON.stringify({
  name: "@ruftech-academy/checker",
  version,
  description: "Checks your Ruftech Academy work on your own computer",
  type: "module",
  bin: { academy: "bin/academy.mjs" },
  files: ["bin", "dist", "checks"],
  engines: { node: ">=22.18" },
  license: "UNLICENSED",
}, null, 2)}\n`);
writeFileSync(join(stage, "README.md"), "# academy\n\nThe Ruftech Academy checker. Install and use: see docs/checker-install.md in the course repository.\n");

const pack = spawnSync("npm", ["pack", "--pack-destination", out, "--silent"], { cwd: stage, encoding: "utf8" });
if (pack.status !== 0) throw new Error(pack.stderr);
const file = join(out, pack.stdout.trim().split("\n").at(-1));
rmSync(stage, { recursive: true, force: true });
console.log(file);
