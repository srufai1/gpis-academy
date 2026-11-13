/** T13: the CLI skeleton, with fake step kinds: run order, exit codes, init, report, path rules. */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const home = mkdtempSync(join(tmpdir(), "academy-home-"));
const checks = mkdtempSync(join(tmpdir(), "academy-checks-"));
process.env.HOME = home;
process.env.ACADEMY_CHECKS_DIR = checks;

const { runSteps, cleanReason } = await import("../packages/checker/src/runner.ts");
const { check } = await import("../packages/checker/src/commands/check.ts");
const { main } = await import("../packages/checker/src/cli.ts");
const { insideRoot } = await import("../packages/checker/src/safe-path.ts");
const { labRoot } = await import("../packages/checker/src/lab.ts");
const { CheckerError } = await import("../packages/checker/src/errors.ts");

let n = 0;
const ok = (v, label) => { assert.ok(v, label); n++; };
const eq = (a, b, label) => { assert.deepEqual(a, b, label); n++; };
const out = () => { const lines = []; return { lines, print: (l) => lines.push(...String(l).split("\n")) }; };

// A fake check: three steps of fake kinds, and a lab with a seed.
function writeCheck(id, steps, extra = "") {
  const dir = join(checks, id, "check");
  mkdirSync(join(dir, "fixtures"), { recursive: true });
  writeFileSync(join(dir, "check.yaml"), `id: ${id}\ntitle: Fake ${id}\nversion: 1.0.0\nunit: fake-unit\n${extra}steps:\n${steps.map((s) => `  - { id: ${s.id}, kind: ${s.kind}, title: "${s.title ?? s.id}", required: ${s.required ?? true} }`).join("\n")}\nmessages:\n  two: "Two did not pass."\n`);
  writeFileSync(join(dir, "fixtures", "seed.sh"), '#!/usr/bin/env bash\nset -e\nrm -rf "$1"; mkdir -p "$1"; echo seeded > "$1/hello.txt"\n');
  return dir;
}
const order = [];
const kinds = {
  files: (s) => { order.push(s.id); return { outcome: s.id === "two" ? "fail" : "pass", reasons: s.id === "two" ? ["line one\nline two"] : [] }; },
  doc: (s) => { order.push(s.id); return { outcome: "pass" }; },
};

writeCheck("fake-a", [{ id: "one", kind: "files" }, { id: "two", kind: "files" }, { id: "three", kind: "doc", required: false }], "lab:\n  root: ~/academy-labs/fake-a/work\n  seed: fixtures/seed.sh\n");
writeCheck("fake-b", [{ id: "one", kind: "files" }, { id: "x", kind: "doc" }]);
writeCheck("fake-c", [{ id: "one", kind: "magic" }]);

try {
  // Steps run in order; a failed step gets the check's message first; reasons are one line.
  const ctx = { workDir: home, checkDir: checks };
  const run = await runSteps([{ id: "one", kind: "files", title: "One", required: true }, { id: "two", kind: "files", title: "Two", required: true }, { id: "three", kind: "doc", title: "Three", required: false }], ctx, kinds, { two: "Two did not pass." });
  eq(order, ["one", "two", "three"], "steps run in order");
  eq(run.steps[1].reasons, ["Two did not pass.", "line one line two"], "a failed step: the check's message, then its own reason on one line");
  eq(run.passed, false, "a failed required step: not passed");
  await assert.rejects(runSteps([{ id: "z", kind: "magic", title: "Z", required: true }], ctx, kinds), CheckerError); n++;
  eq(cleanReason("x".repeat(400)).length, 300, "reasons are cut to 300 characters");

  // check(): exit 0 on pass, 1 on not passed; the report has one line per step.
  const bOut = out();
  eq(await check("fake-b", { dryRun: true, dir: home }, kinds, bOut.print), 0, "passed: exit 0");
  eq(bOut.lines.at(-1), "Result: PASSED · dry run, nothing sent");
  eq(bOut.lines[0], "fake-b · Fake fake-b · check v1.0.0", "header: id, title, version");

  // init builds the lab from the seed and refuses to overwrite without --reset.
  const i1 = out();
  eq(await main(["init", "fake-a"], i1.print, i1.print), 0, "init: exit 0");
  const lab = join(home, "academy-labs", "fake-a", "work");
  ok(readFileSync(join(lab, "hello.txt"), "utf8").startsWith("seeded"), "the lab was seeded");
  writeFileSync(join(lab, "mine.txt"), "my work");
  const i2 = out();
  eq(await main(["init", "fake-a"], i2.print, i2.print), 1, "init again without --reset: refused");
  ok(existsSync(join(lab, "mine.txt")), "the learner's work is kept");
  eq(await main(["init", "fake-a", "--reset"], () => {}, () => {}), 0, "with --reset it starts again");
  ok(!existsSync(join(lab, "mine.txt")), "--reset rebuilt the folder");

  const aOut = out();
  eq(await check("fake-a", { dryRun: true }, kinds, aOut.print), 1, "not passed: exit 1 (and it checked the lab folder)");
  ok(aOut.lines.some((l) => l.includes("FAIL  files   two")), "the failing step is reported");
  ok(aOut.lines.some((l) => l.includes("(optional)")), "optional steps are marked");

  // Exit 2: unknown kind, unknown check, missing id, unknown command.
  const err = out();
  eq(await main(["check", "fake-c", "--dry-run"], err.print, err.print), 2, "unknown step kind: exit 2, never a pass");
  ok(err.lines.some((l) => /kind must be one of/.test(l)), "the message says which kinds are allowed");
  eq(await main(["check", "nope-1"], () => {}, () => {}), 2, "unknown check: exit 2");
  eq(await main(["check"], () => {}, () => {}), 2, "no id: exit 2");
  eq(await main(["fly"], () => {}, () => {}), 2, "unknown command: exit 2");
  eq(await main(["check", "../etc"], () => {}, () => {}), 2, "a path is not a check id");

  // Paths stay inside their root.
  for (const bad of ["../x", "/etc/passwd", "a/../../x"]) { assert.throws(() => insideRoot(home, bad), CheckerError, bad); n++; }
  eq(insideRoot(home, "a/b"), join(home, "a/b"));
  assert.throws(() => labRoot("~/../etc"), CheckerError); n++;
  assert.throws(() => labRoot("/tmp/lab"), CheckerError); n++;
  assert.throws(() => labRoot("~/academy-labs"), CheckerError, "not the labs folder itself"); n++;
} finally {
  rmSync(home, { recursive: true, force: true });
  rmSync(checks, { recursive: true, force: true });
}
console.log(`CLI runner: ${n} checks passed.`);
