/**
 * T14: files, doc and git step kinds. The sample check m1-p1 fails on a fresh seed and
 * passes on a solved copy (its files and doc steps); path escapes are refused; the git
 * step counts commits, judges messages and finds secrets without printing them.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { runSteps } from "../packages/checker/src/runner.ts";
import { STEP_KINDS } from "../packages/checker/src/steps/index.ts";
import { filesStep } from "../packages/checker/src/steps/files.ts";
import { gitStep } from "../packages/checker/src/steps/git.ts";
import { CheckerError } from "../packages/checker/src/errors.ts";

const checkDir = fileURLToPath(new URL("../content/module-01/unit-01/check/", import.meta.url));
const def = parse(readFileSync(join(checkDir, "check.yaml"), "utf8"));
const readOnlySteps = def.steps.filter((s) => ["files", "doc"].includes(s.kind));
const work = mkdtempSync(join(tmpdir(), "academy-files-"));
let n = 0;
const eq = (a, b, label) => { assert.deepEqual(a, b, label); n++; };

try {
  // Fresh seed: fails, for the reasons the lab describes.
  const lab = join(work, "office");
  assert.equal(spawnSync("bash", [join(checkDir, "fixtures", "seed.sh"), lab]).status, 0, "seed runs");
  const fresh = await runSteps(readOnlySteps, { workDir: lab, checkDir }, STEP_KINDS, def.messages);
  eq(fresh.passed, false, "m1-p1 fails on a fresh seed");
  eq(fresh.steps.filter((s) => s.outcome === "fail").map((s) => s.id),
    ["class-list", "term-2-notes", "current-link", "fees-permissions", "finance-directory", "backup-script", "settings", "no-tmp", "answers"],
    "every repair is still to do");

  // Solve it, the way the lab asks.
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
  const solved = await runSteps(readOnlySteps, { workDir: lab, checkDir }, STEP_KINDS, def.messages);
  eq(solved.steps.filter((s) => s.outcome !== "pass").map((s) => [s.id, s.reasons]), [], "m1-p1 passes on a solved copy");

  // One wrong detail at a time is caught.
  chmodSync(join(lab, "finance/fees.csv"), 0o644);
  const wrongMode = await runSteps(readOnlySteps, { workDir: lab, checkDir }, STEP_KINDS, def.messages);
  eq(wrongMode.steps.find((s) => s.id === "fees-permissions").reasons.at(-1), "finance/fees.csv has mode 644, not 640");
  chmodSync(join(lab, "finance/fees.csv"), 0o640);
  writeFileSync(join(lab, "answers.md"), `## Owner, group, others\nToo short.\n`);
  const doc = (await runSteps(readOnlySteps, { workDir: lab, checkDir }, STEP_KINDS, def.messages)).steps.find((s) => s.id === "answers");
  eq(doc.outcome, "fail");
  assert.ok(doc.reasons.some((r) => r.includes("missing heading: ## Why the link was broken"))); n++;

  // Path escapes are refused, never followed.
  const step = (expect) => ({ id: "s", kind: "files", title: "S", required: true, expect });
  for (const path of ["../outside.txt", "/etc/passwd", "a/../../outside.txt"]) {
    assert.throws(() => filesStep(step([{ path, type: "file" }]), { workDir: lab, checkDir }), CheckerError, path); n++;
  }
  assert.throws(() => filesStep(step([{ glob: "../**/*" , type: "absent" }]), { workDir: lab, checkDir }), CheckerError); n++;
  writeFileSync(join(work, "secret.txt"), "outside");
  symlinkSync(join(work, "secret.txt"), join(lab, "sneaky"));
  eq(filesStep(step([{ path: "sneaky", type: "symlink", resolves: true }]), { workDir: lab, checkDir }).outcome, "fail", "a link that points outside the project does not count as opening");
  eq(filesStep(step([{ path: "sneaky", sha256_of: "fixtures/class-list.txt" }]), { workDir: lab, checkDir }).reasons, ["sneaky points outside the project"], "content is never read through a link that leaves the project");
  assert.throws(() => filesStep(step([{ path: "x", sha256_of: "../../../../etc/passwd" }]), { workDir: lab, checkDir }), CheckerError, "a check cannot read outside its own folder either"); n++;

  // git: commits, messages, secrets (named, never printed).
  const repo = join(work, "repo");
  const g = (...args) => spawnSync("git", ["-C", repo, "-c", "user.name=T", "-c", "user.email=t@t", ...args], { encoding: "utf8" });
  spawnSync("git", ["init", "-q", repo]);
  writeFileSync(join(repo, "a.txt"), "one\n"); g("add", "."); g("commit", "-qm", "Add the first file");
  writeFileSync(join(repo, "b.txt"), "two\n"); g("add", "."); g("commit", "-qm", "wip");
  const gstep = (expect) => gitStep({ id: "g", kind: "git", title: "G", required: true, expect }, { workDir: repo, checkDir });
  eq(gstep({ min_commits: 2 }).outcome, "pass", "two commits");
  eq(gstep({ min_commits: 3 }).reasons, ["2 commits; at least 3 are needed"]);
  assert.match(gstep({ forbidden_messages: ["wip"] }).reasons[0], /"wip" does not say what changed/); n++;
  const key = "sb_secret_" + "A1b2C3d4E5f6G7h8";
  writeFileSync(join(repo, ".env"), `KEY=${key}\n`); g("add", "."); g("commit", "-qm", "Add settings");
  const secret = gstep({});
  eq(secret.outcome, "fail", "a committed secret key fails the step");
  assert.ok(secret.reasons[0].includes("adds a Supabase secret key") && !secret.reasons.join(" ").includes(key), "the secret is named, never printed"); n++;
  eq(gitStep({ id: "g", kind: "git", title: "G", required: true, expect: {} }, { workDir: work, checkDir }).reasons, ["This folder is not a Git repository: run git init"]);
} finally {
  rmSync(work, { recursive: true, force: true });
}
console.log(`Steps files/doc/git: ${n} checks passed.`);
