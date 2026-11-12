/**
 * T05: the sample unit loads; six broken copies each fail with the file name and
 * the reason; the manifest is stable; quiz answers never reach the browser.
 */
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildContent } from "./lib/content-build.mjs";
import { toPublicQuiz } from "../packages/shared/src/content-schema.ts";

const contentRoot = fileURLToPath(new URL("../content/", import.meta.url));
let checks = 0;
const work = mkdtempSync(join(tmpdir(), "academy-content-"));

/** A fresh copy of content/ with one change, built against the committed manifest. */
function brokenCopy(name, change) {
  const dir = join(work, name);
  cpSync(contentRoot, dir, { recursive: true });
  change(dir);
  const previous = JSON.parse(readFileSync(join(contentRoot, "manifest.json"), "utf8"));
  try { buildContent(dir, previous); } catch (error) { return error.message; }
  return null;
}
const expectFailure = (name, change, file, reason) => {
  const message = brokenCopy(name, change);
  assert.ok(message, `${name}: the build must fail`);
  assert.ok(message.includes(file), `${name}: the message names ${file}\n${message}`);
  assert.match(message, reason, `${name}: the message gives the reason\n${message}`);
  checks++;
};
const unit = (dir) => join(dir, "module-01", "unit-01");
const editJson = (path, edit) => { const v = JSON.parse(readFileSync(path, "utf8")); edit(v); writeFileSync(path, JSON.stringify(v)); };

try {
  // The sample unit loads.
  const { course, index, manifest } = buildContent(contentRoot, JSON.parse(readFileSync(join(contentRoot, "manifest.json"), "utf8")));
  assert.deepEqual(course.units.map((u) => u.meta.id), ["m1-u1"]); checks++;
  assert.equal(index.items.filter((i) => i.kind === "module").length, 10, "all ten modules are in the index"); checks++;
  assert.ok(index.items.every((i) => /^[0-9a-f]{64}$/.test(i.content_hash)), "every item has a content hash"); checks++;
  assert.deepEqual(manifest.checks.map((c) => [c.id, c.version]), [["m1-p1", "1.0.0"]]); checks++;

  // The manifest hash is stable across two runs.
  assert.deepEqual(buildContent(contentRoot).manifest, buildContent(contentRoot).manifest); checks++;
  // The committed files are up to date.
  assert.equal(readFileSync(join(contentRoot, "manifest.json"), "utf8"), `${JSON.stringify(manifest, null, 2)}\n`, "content/manifest.json is up to date"); checks++;
  assert.equal(readFileSync(join(contentRoot, "index.json"), "utf8"), `${JSON.stringify(index, null, 2)}\n`, "content/index.json is up to date"); checks++;

  // Six broken copies.
  expectFailure("missing file", (d) => rmSync(join(unit(d), "lab.md")), "module-01/unit-01/lab.md", /missing/);
  expectFailure("answer out of range", (d) => editJson(join(unit(d), "quiz.json"), (q) => { q.questions[0].answer = 9; }), "quiz.json", /answer is out of range/);
  expectFailure("duplicate id", (d) => editJson(join(unit(d), "quiz.json"), (q) => { q.id = "m1-u1"; }), "module-01/unit-01", /id "m1-u1" is already used/);
  expectFailure("check changed, same version", (d) => appendFileSync(join(unit(d), "check", "fixtures", "class-list.txt"), "x\n"), "check/check.yaml", /changed but version 1\.0\.0 did not/);
  expectFailure("front matter field", (d) => {
    const p = join(unit(d), "unit.md");
    writeFileSync(p, readFileSync(p, "utf8").replace("guidance: guided", "guidance: easy"));
  }, "unit.md", /guidance must be guided, half or independent/);
  expectFailure("unknown step kind", (d) => {
    const p = join(unit(d), "check", "check.yaml");
    writeFileSync(p, readFileSync(p, "utf8").replace("kind: doc", "kind: magic").replace("version: 1.0.0", "version: 1.0.1"));
  }, "check/check.yaml", /kind must be one of/);

  // A new version with a changed check is accepted.
  assert.equal(brokenCopy("new version", (d) => {
    appendFileSync(join(unit(d), "check", "fixtures", "class-list.txt"), "x\n");
    const p = join(unit(d), "check", "check.yaml");
    writeFileSync(p, readFileSync(p, "utf8").replace("version: 1.0.0", "version: 1.1.0"));
  }), null, "a check change with a new version builds"); checks++;

  // Quiz answers and reasons never reach the browser before marking.
  const pub = JSON.stringify(toPublicQuiz(course.units[0].quiz));
  assert.ok(!/"answer"|"why"|"wrong"/.test(pub), "the public quiz has no answers or reasons"); checks++;
  assert.ok(!/"answer"|"why"|"wrong"/.test(JSON.stringify(index)), "index.json has no answers or reasons"); checks++;
} finally {
  rmSync(work, { recursive: true, force: true });
}
console.log(`Content: ${checks} checks passed.`);
