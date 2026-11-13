/**
 * T21, on temporary repositories: academy check <id> --at <commit> checks a past state in a
 * temporary Git worktree, records that commit with a clean tree, and never touches the
 * learner's working folder — also when the check throws.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const checks = mkdtempSync(join(tmpdir(), "academy-at-checks-"));
process.env.HOME = mkdtempSync(join(tmpdir(), "academy-at-home-"));
process.env.ACADEMY_CHECKS_DIR = checks;

const { check } = await import("../packages/checker/src/commands/check.ts");
const { atCommit, isCommitRef } = await import("../packages/checker/src/commands/check-at.ts");
const { commitOf } = await import("../packages/checker/src/send.ts");
const { main } = await import("../packages/checker/src/cli.ts");
const { CheckerError } = await import("../packages/checker/src/errors.ts");

let n = 0;
const ok = (v, label) => { assert.ok(v, label); n++; };
const eq = (a, b, label) => { assert.deepEqual(a, b, label); n++; };

// A check whose one step reads src/grade.txt in the folder it is given.
mkdirSync(join(checks, "m9-p2", "check"), { recursive: true });
writeFileSync(join(checks, "m9-p2", "check", "check.yaml"), `id: m9-p2
title: Grading fix
version: 1.0.0
unit: fake-unit
steps:
  - { id: grade, kind: files, title: "grade.txt says fixed", required: true }
`);
const seen = [];
const kinds = {
  files: (_step, ctx) => {
    seen.push(ctx.workDir);
    const text = existsSync(join(ctx.workDir, "src", "grade.txt")) ? readFileSync(join(ctx.workDir, "src", "grade.txt"), "utf8") : "";
    return text.includes("fixed") ? { outcome: "pass" } : { outcome: "fail", reasons: [`grade.txt says "${text.trim()}"`] };
  },
};

// A project: commit 1 broken, commit 2 fixed; then uncommitted and untracked work on top.
const repo = mkdtempSync(join(tmpdir(), "academy-at-repo-"));
const git = (...args) => spawnSync("git", ["-C", repo, "-c", "user.name=Learner", "-c", "user.email=l@example.test", ...args], { encoding: "utf8" });
git("init", "-q");
mkdirSync(join(repo, "src"));
writeFileSync(join(repo, "src", "grade.txt"), "broken\n");
git("add", "."); git("commit", "-q", "-m", "First try");
const c1 = git("rev-parse", "HEAD").stdout.trim();
writeFileSync(join(repo, "src", "grade.txt"), "fixed\n");
git("add", "."); git("commit", "-q", "-m", "Fix the grade");
const c2 = git("rev-parse", "HEAD").stdout.trim();
writeFileSync(join(repo, "src", "grade.txt"), "half-done edit, not committed\n");
writeFileSync(join(repo, "scratch.md"), "untracked notes\n");
const before = { status: git("status", "--porcelain").stdout, head: git("rev-parse", "HEAD").stdout, branch: git("branch", "--show-current").stdout };
const temps = () => readdirSync(tmpdir()).filter((f) => f.startsWith("academy-at-") && !/checks|home|repo/.test(f));
const tempsBefore = temps().length;

const run = async (at, dir = repo) => {
  const lines = [];
  const code = await check("m9-p2", { dryRun: true, dir, at }, kinds, (l) => lines.push(...String(l).split("\n")));
  return { code, last: lines.find((l) => l.startsWith("Result:")), lines };
};

let r = await run(undefined);
eq(r.code, 1, "without --at: the working folder (half-done edit) is checked and fails");
r = await run(c2.slice(0, 7));
eq(r.code, 0, "--at the fixed commit passes, although the working folder holds an uncommitted edit");
eq(r.last, `Result: PASSED · commit ${c2.slice(0, 7)} · dry run, nothing sent`, "the report names the commit it checked");
r = await run(c1);
ok(r.code === 1 && r.lines.some((l) => l.includes('grade.txt says "broken"')), "--at the first commit fails with that commit's content");
r = await run("HEAD~1");
eq(r.code, 1, "HEAD~1 works too");
r = await run("HEAD");
eq(r.code, 0, "HEAD is the last commit, not the working folder");
ok(seen.slice(1).every((d) => !d.startsWith(repo)), "the steps ran outside the learner's folder");

eq({ status: git("status", "--porcelain").stdout, head: git("rev-parse", "HEAD").stdout, branch: git("branch", "--show-current").stdout }, before, "the working folder, its uncommitted edit, its untracked file and its branch are untouched");
eq(readFileSync(join(repo, "src", "grade.txt"), "utf8"), "half-done edit, not committed\n", "the uncommitted edit is byte for byte the same");
eq(git("worktree", "list", "--porcelain").stdout.split("\n").filter((l) => l.startsWith("worktree ")).length, 1, "no worktree is left behind");
eq(temps().length, tempsBefore, "no temporary folder is left behind");

// The result records the commit and a clean tree.
const recorded = await atCommit(repo, c1, async (dir) => commitOf(dir));
eq(recorded, { sha: c1, clean: true }, "the result records that commit and 'clean tree: yes'");

// Also on failure: a step that throws still removes the worktree.
await assert.rejects(atCommit(repo, c2, async () => { throw new Error("boom"); }), /boom/); n++;
eq(git("worktree", "list", "--porcelain").stdout.split("\n").filter((l) => l.startsWith("worktree ")).length, 1, "after a crash: no worktree left");
eq(temps().length, tempsBefore, "after a crash: no temporary folder left");

// A sub-folder of the project is checked in the same sub-folder of the copy.
mkdirSync(join(repo, "app", "src"), { recursive: true });
writeFileSync(join(repo, "app", "src", "grade.txt"), "fixed\n");
git("add", "app"); git("commit", "-q", "-m", "App folder");
seen.length = 0;
r = await run("HEAD", join(repo, "app"));
ok(r.code === 0 && seen[0].endsWith(join("tree", "app")), "a sub-folder is checked in the same sub-folder of the copy");

// Refused input, with a plain sentence.
for (const bad of ["-x", "--upload-pack=evil", "a..b", "../../etc", "", "x".repeat(101), "@{-1}"]) ok(!isCommitRef(bad), `refused: ${JSON.stringify(bad)}`);
for (const good of ["a1b2c3d", "main", "v1.0", "HEAD~2", "HEAD^", "feature/grading"]) ok(isCommitRef(good), `accepted: ${good}`);
await assert.rejects(run("nope123"), (e) => e instanceof CheckerError && /was not found/.test(e.message)); n++;
await assert.rejects(run("-x"), (e) => e instanceof CheckerError && /is not a commit/.test(e.message)); n++;
const notGit = mkdtempSync(join(tmpdir(), "academy-at-nogit-"));
await assert.rejects(run("HEAD", notGit), (e) => e instanceof CheckerError && /needs a Git project/.test(e.message)); n++;

// The command line: --at <commit> and --at=<commit>, offline (--dry-run).
// The command line runs the real step kinds, so this check uses the real files format.
mkdirSync(join(checks, "m9-p3", "check"), { recursive: true });
writeFileSync(join(checks, "m9-p3", "check", "check.yaml"), `id: m9-p3
title: App folder
version: 1.0.0
unit: fake-unit
steps:
  - id: app
    kind: files
    title: app/src/grade.txt exists
    required: true
    expect:
      - path: app/src/grade.txt
        type: file
`);
const out = [];
eq(await main(["check", "m9-p3", "--dry-run", `--dir=${repo}`, "--at", "HEAD"], (l) => out.push(l), (l) => out.push(l)), 0, `academy check m9-p3 --at HEAD\n${out.join("\n")}`);
eq(await main(["check", "m9-p3", "--dry-run", `--dir=${repo}`, `--at=${c1}`], (l) => out.push(l), (l) => out.push(l)), 1, `academy check m9-p3 --at=<first commit>\n${out.join("\n")}`);
ok(out.some((l) => l.includes(`commit ${c1.slice(0, 7)} · dry run, nothing sent`)), "the command line names the commit it checked");

console.log(`Check at a commit: ${n} checks passed.`);
