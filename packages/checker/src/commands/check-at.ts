/**
 * academy check <id> --at <commit> (T21): check a past state of the project without touching
 * the working folder. Git makes a temporary worktree (a second, separate checkout of that
 * commit) in the system's temp folder; the check runs there; the worktree is removed
 * afterwards — also when the check fails or throws. Uncommitted work is never touched:
 * nothing here runs checkout, reset or stash in the learner's folder.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { CheckerError } from "../errors.ts";
import { isInside } from "../safe-path.ts";

const git = (dir: string, args: string[]) => spawnSync("git", ["-C", dir, ...args], { encoding: "utf8", timeout: 60_000 });

/**
 * A commit as the learner types it: a hash, a branch, a tag, HEAD~2… Never an option
 * ("-…"), never a path trick, and short.
 */
export function isCommitRef(ref: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._/~^@{}-]{0,99}$/.test(ref) && !ref.includes("..") && !ref.includes("@{-");
}

/** Run `work(dir)` in a temporary worktree of `commit`; `dir` is the same sub-folder as `workDir`. */
export async function atCommit<T>(workDir: string, commit: string, work: (dir: string, sha: string) => Promise<T>): Promise<T> {
  if (!isCommitRef(commit)) throw new CheckerError(`"${commit}" is not a commit. Use a commit hash (see git log --oneline), a branch or a tag.`);
  const top = git(workDir, ["rev-parse", "--show-toplevel"]);
  if (top.status !== 0) throw new CheckerError(`--at needs a Git project, and ${workDir} is not inside one.`);
  const root = realpathSync(top.stdout.trim());
  const resolved = git(root, ["rev-parse", "--verify", "--quiet", "--end-of-options", `${commit}^{commit}`]);
  const sha = resolved.stdout.trim();
  if (resolved.status !== 0 || !/^[0-9a-f]{40,64}$/.test(sha)) {
    throw new CheckerError(`Commit "${commit}" was not found in this project. See git log --oneline.`);
  }
  // Leftovers of an earlier run that was stopped (Ctrl+C) are forgotten by Git first.
  git(root, ["worktree", "prune"]);

  const temp = mkdtempSync(join(tmpdir(), "academy-at-"));
  const tree = join(temp, "tree");
  const added = git(root, ["worktree", "add", "--detach", "--quiet", tree, sha]);
  if (added.status !== 0) {
    rmSync(temp, { recursive: true, force: true });
    throw new CheckerError(`Git could not make a copy of commit ${sha.slice(0, 7)}: ${added.stderr.trim().split("\n")[0] ?? "unknown error"}`);
  }
  try {
    const inside = join(tree, relative(root, realpathSync(workDir)));
    if (!isInside(tree, inside)) throw new CheckerError("The work folder is not inside the Git project.");
    return await work(inside, sha);
  } finally {
    git(root, ["worktree", "remove", "--force", tree]);
    rmSync(temp, { recursive: true, force: true });
    git(root, ["worktree", "prune"]);
  }
}
