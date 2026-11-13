/**
 * T15: tests and static step kinds: pass, fail, timeout, too much output; course test files
 * counted with node --test; and the whole m1-p1 check end to end through the CLI.
 */
import assert from "node:assert/strict";
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const work = mkdtempSync(join(tmpdir(), "academy-run-"));
process.env.HOME = work;
const { testsStep } = await import("../packages/checker/src/steps/tests.ts");
const { staticStep } = await import("../packages/checker/src/steps/static.ts");
const { main } = await import("../packages/checker/src/cli.ts");
let n = 0;
const eq = (a, b, label) => { assert.deepEqual(a, b, label); n++; };
const step = (extra) => ({ id: "t", kind: "tests", title: "T", required: true, ...extra });
const ctx = { workDir: work, checkDir: work };

try {
  // Commands: pass, wrong output, wrong exit, timeout, too much output.
  eq((await testsStep(step({ run: { command: "echo backup ok", expect_stdout: "backup ok\n" } }), ctx)).outcome, "pass", "right output: pass");
  const wrong = await testsStep(step({ run: { command: "echo nope", expect_stdout: "backup ok\n" } }), ctx);
  eq(wrong.outcome, "fail");
  assert.match(wrong.reasons[0], /printed "nope\\n", expected "backup ok\\n"/); n++;
  assert.match((await testsStep(step({ run: { command: "exit 3" } }), ctx)).reasons[0], /ended with code 3, expected 0/); n++;
  const started = Date.now();
  const slow = await testsStep(step({ run: { command: "sleep 30", timeout_seconds: 1 } }), ctx);
  eq(slow.outcome, "fail");
  assert.match(slow.reasons[0], /took longer than 1 s and was stopped/); n++;
  assert.ok(Date.now() - started < 10000, "a timeout really stops the command"); n++;
  const loud = await testsStep(step({ run: { command: "yes academy" , timeout_seconds: 20 } }), ctx);
  assert.match(loud.reasons[0], /printed too much output and was stopped/); n++;

  // Course test files, run with node --test inside the project: counts and names of failures.
  mkdirSync(join(work, "tests"));
  writeFileSync(join(work, "tests", "rank.test.mjs"), `import test from "node:test"; import assert from "node:assert";
test("ties share a position", () => assert.equal(1, 1));
test("the next one is skipped", () => assert.equal(2, 3));
test("an empty list", () => assert.equal(0, 0));`);
  const files = await testsStep(step({ files: ["tests/rank.test.mjs"] }), ctx);
  eq(files.outcome, "fail");
  eq(files.reasons, ["2 of 3 passed", "failed: the next one is skipped"], "how many passed, and which failed");
  writeFileSync(join(work, "tests", "ok.test.mjs"), `import test from "node:test"; test("fine", () => {});`);
  eq(await testsStep(step({ files: ["tests/ok.test.mjs"] }), ctx), { outcome: "pass", reasons: ["1 of 1 passed"] });
  writeFileSync(join(work, "tests", "loop.test.mjs"), `import test from "node:test"; test("forever", () => { for (;;) {} });`);
  assert.match((await testsStep(step({ files: ["tests/loop.test.mjs"], timeout_seconds: 2 }), ctx)).reasons[0], /took too long/); n++;

  // static: the project's own lint and build; a missing one is not a failure.
  const project = join(work, "project");
  mkdirSync(project);
  const sctx = { workDir: project, checkDir: work };
  eq((await staticStep({ id: "s", kind: "static", title: "S", required: true }, sctx)).outcome, "skipped", "nothing to run: skipped, not passed");
  writeFileSync(join(project, "package.json"), JSON.stringify({ scripts: { lint: "node -e \"process.exit(0)\"", build: "node -e \"console.error('Type error in page.tsx'); process.exit(1)\"" } }));
  const s = await staticStep({ id: "s", kind: "static", title: "S", required: true }, sctx);
  eq(s.outcome, "fail");
  eq(s.reasons, ["build failed", "Type error in page.tsx"], "the failing command and its last line");
  writeFileSync(join(project, "package.json"), JSON.stringify({ scripts: { lint: "node -e \"process.exit(0)\"", build: "node -e \"process.exit(0)\"" } }));
  eq(await staticStep({ id: "s", kind: "static", title: "S", required: true }, sctx), { outcome: "pass", reasons: ["lint, build"] });

  // The whole sample check, end to end: init, solve, check → exit 0.
  const checkDir = fileURLToPath(new URL("../content/module-01/unit-01/check/", import.meta.url));
  const lines = [];
  const print = (l) => lines.push(...String(l).split("\n"));
  eq(await main(["init", "m1-p1"], print, print), 0, "init m1-p1");
  eq(await main(["check", "m1-p1", "--dry-run"], print, print), 1, "fresh lab: not passed");
  const lab = join(work, "academy-labs", "m1-p1", "office");
  renameSync(join(lab, "old/misc/class-list.txt"), join(lab, "reports/term-1/class-list.txt"));
  renameSync(join(lab, "term 2 notes.txt"), join(lab, "reports/term-2/term 2 notes.txt"));
  unlinkSync(join(lab, "current"));
  symlinkSync("reports/term-2", join(lab, "current"));
  chmodSync(join(lab, "finance/fees.csv"), 0o640);
  chmodSync(join(lab, "finance"), 0o750);
  chmodSync(join(lab, "scripts/backup.sh"), 0o744);
  copyFileSync(join(checkDir, "fixtures/settings.expected.conf"), join(lab, "settings.conf"));
  for (const f of ["reports/term-1/draft.tmp", "old/.cache.tmp", "finance/export.tmp"]) unlinkSync(join(lab, f));
  const para = "In my own words this is a full answer with enough words to explain the idea clearly for the reader today.";
  writeFileSync(join(lab, "answers.md"), `## Owner, group, others\n${para}\n\n## Execute on a file and on a directory\n${para}\n\n## Why the link was broken\n${para}\n`);
  lines.length = 0;
  eq(await main(["check", "m1-p1", "--dry-run"], print, print), 0, `solved lab: passed\n${lines.join("\n")}`);
  eq(lines.at(-1), "Result: PASSED · dry run, nothing sent");
  eq(lines.filter((l) => l.startsWith("  PASS")).length, 10, "all ten steps pass, including backup.sh printing 'backup ok'");
} finally {
  rmSync(work, { recursive: true, force: true });
}
console.log(`Steps tests/static: ${n} checks passed.`);
