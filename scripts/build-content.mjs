/**
 * Builds content/index.json and content/manifest.json from content/ (T05).
 *   node scripts/build-content.mjs          write both files
 *   node scripts/build-content.mjs --check  only check; fail if they are out of date
 * Stops with "file: reason" lines when the content is not valid.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { buildContent } from "./lib/content-build.mjs";

const contentRoot = fileURLToPath(new URL("../content/", import.meta.url));
const indexPath = join(contentRoot, "index.json");
const manifestPath = join(contentRoot, "manifest.json");
const onlyCheck = process.argv.includes("--check");

try {
  const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : null;
  const { index, manifest } = buildContent(contentRoot, previous);
  const files = [[indexPath, index], [manifestPath, manifest]].map(([path, value]) => [path, `${JSON.stringify(value, null, 2)}\n`]);
  if (onlyCheck) {
    const stale = files.filter(([path, text]) => !existsSync(path) || readFileSync(path, "utf8") !== text);
    if (stale.length) {
      console.error(`Out of date: ${stale.map(([p]) => p.slice(contentRoot.length)).join(", ")}. Run: node scripts/build-content.mjs`);
      process.exit(1);
    }
    console.log("Content index and manifest are up to date.");
  } else {
    files.forEach(([path, text]) => writeFileSync(path, text));
    console.log(`Wrote content/index.json (${index.items.length} items) and content/manifest.json (${manifest.checks.length} checks).`);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
