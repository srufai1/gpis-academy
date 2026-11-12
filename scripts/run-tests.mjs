/**
 * Runs every scripts/test-*.mjs and scripts/test-*.ts file, one at a time,
 * and fails if any of them fails (same idea as GPIS).
 *
 * Browser tests (file names containing "browser") need a built app and
 * Playwright, so they run only with --with-browser.
 * A file can be run on its own: node scripts/run-tests.mjs test-repo-rules.mjs
 */
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const withBrowser = args.includes("--with-browser");
const only = args.filter((a) => !a.startsWith("--"));

const files = readdirSync(dir)
  .filter((f) => /^test-.*\.(mjs|ts)$/.test(f))
  .filter((f) => only.length === 0 || only.includes(f))
  .filter((f) => withBrowser || only.length > 0 || !f.includes("browser"))
  .sort();

let failed = 0;
for (const file of files) {
  const argv = file.endsWith(".ts")
    ? ["--experimental-strip-types", "--no-warnings", join(dir, file)]
    : [join(dir, file)];
  const run = spawnSync(process.execPath, argv, { stdio: "inherit" });
  const ok = run.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${file}`);
}
console.log(`\n${files.length - failed} passed · ${failed} failed (of ${files.length})`);
if (files.length === 0) console.log("No test files found.");
process.exit(failed === 0 ? 0 : 1);
