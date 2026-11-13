/**
 * Repository rules (AGENTS.md):
 * 1. No secret key or service-role key anywhere under a src/ folder.
 * 2. .env.example holds variable names only, never a value.
 * 3. The site name is typed only in apps/web/src/config/site.ts.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const skip = new Set(["node_modules", ".next", ".git", "out", "build", "dist"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

let checks = 0;
const files = walk(root);
const inSrc = files.filter((f) => relative(root, f).split(/[\\/]/).includes("src"));
assert.ok(inSrc.length > 0, "there are src/ files to scan");
// The one exception: the checker's git step SEARCHES learners' history for these words, so it
// must name them as patterns. It holds no key. Any other file under src/ may not contain them.
const SECRET_PATTERN_FILES = new Set(["packages/checker/src/steps/git.ts"]);
for (const file of inSrc) {
  const text = readFileSync(file, "utf8");
  if (SECRET_PATTERN_FILES.has(relative(root, file).split("\\").join("/"))) {
    assert.ok(!/sb_secret_[A-Za-z0-9_-]{10,}/.test(text.replace("sb_secret_[A-Za-z0-9_-]{10,}", "")), `a real-looking secret key in ${relative(root, file)}`);
    checks++;
    continue;
  }
  assert.ok(!text.includes("sb_secret_"), `secret key found in ${relative(root, file)}`);
  assert.ok(!/service_role/i.test(text), `service_role found in ${relative(root, file)}`);
  checks++;
}

const example = readFileSync(join(root, ".env.example"), "utf8");
for (const line of example.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  assert.match(trimmed, /^[A-Z][A-Z0-9_]*=$/, `.env.example must hold names only: ${trimmed}`);
  checks++;
}

// 3. The site name is typed only in apps/web/src/config/site.ts (AGENTS.md rule 3).
for (const file of inSrc.filter((f) => relative(root, f).startsWith("apps/web/src/"))) {
  if (relative(root, file) === "apps/web/src/config/site.ts") continue;
  assert.ok(!readFileSync(file, "utf8").includes("Ruftech Academy"), `site name typed outside site.ts: ${relative(root, file)}`);
  checks++;
}

console.log(`Repository rules: ${checks} checks passed.`);
