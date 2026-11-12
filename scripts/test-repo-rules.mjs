/**
 * Repository rules (AGENTS.md):
 * 1. No secret key or service-role key anywhere under a src/ folder.
 * 2. .env.example holds variable names only, never a value.
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
for (const file of inSrc) {
  const text = readFileSync(file, "utf8");
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

console.log(`Repository rules: ${checks} checks passed.`);
