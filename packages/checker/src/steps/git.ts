/**
 * Step kind "git" (T14): the project's history. Only reads.
 *   expect: { min_commits, message_min_chars, forbidden_messages: ["wip", …], no_secrets: true, secret_patterns: [regex…] }
 * Secrets are searched in every commit's changes; only the commit and pattern name are reported, never the text.
 */
import { spawnSync } from "node:child_process";
import { CheckerError } from "../errors.ts";
import type { StepKindImpl } from "../runner.ts";

export const DEFAULT_SECRET_PATTERNS: Record<string, string> = {
  "Supabase secret key": "sb_secret_[A-Za-z0-9_-]{10,}",
  "service_role key": "service_role",
  "private key": "-----BEGIN [A-Z ]*PRIVATE KEY-----",
  "GitHub token": "gh[pousr]_[A-Za-z0-9]{30,}",
};

const git = (cwd: string, args: string[]) => spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8", timeout: 20000, maxBuffer: 64 * 1024 * 1024 });

export const gitStep: StepKindImpl = (step, ctx) => {
  const e = (step.expect ?? {}) as { min_commits?: number; message_min_chars?: number; forbidden_messages?: string[]; no_secrets?: boolean; secret_patterns?: Record<string, string> };
  const probe = git(ctx.workDir, ["rev-parse", "--is-inside-work-tree"]);
  if (probe.error) return { outcome: "needs", reasons: ["Git is not installed: sudo apt install git"] };
  if (probe.status !== 0) return { outcome: "fail", reasons: ["This folder is not a Git repository: run git init"] };

  const log = git(ctx.workDir, ["log", "--format=%h%x09%s"]);
  const commits = log.status === 0 ? log.stdout.split("\n").filter(Boolean).map((l) => { const [sha = "", ...msg] = l.split("\t"); return { sha, msg: msg.join("\t") }; }) : [];
  const reasons: string[] = [];
  if (e.min_commits && commits.length < e.min_commits) reasons.push(`${commits.length} commit${commits.length === 1 ? "" : "s"}; at least ${e.min_commits} are needed`);
  for (const c of commits) {
    if (e.message_min_chars && c.msg.trim().length < e.message_min_chars) reasons.push(`commit ${c.sha}: message "${c.msg.trim()}" is too short`);
    if (e.forbidden_messages?.some((f) => c.msg.trim().toLowerCase() === f.toLowerCase())) reasons.push(`commit ${c.sha}: "${c.msg.trim()}" does not say what changed`);
  }
  if (e.no_secrets !== false && commits.length > 0) {
    const patterns = { ...DEFAULT_SECRET_PATTERNS, ...(e.secret_patterns ?? {}) };
    const diff = git(ctx.workDir, ["log", "-p", "--all", "--format=commit %h", "--no-color", "--no-ext-diff"]);
    if (diff.status !== 0) throw new CheckerError("could not read the Git history");
    let current = "";
    const found = new Set<string>();
    for (const line of diff.stdout.split("\n")) {
      if (line.startsWith("commit ")) { current = line.slice(7); continue; }
      if (!line.startsWith("+") || line.startsWith("+++")) continue;
      for (const [name, re] of Object.entries(patterns)) if (new RegExp(re).test(line)) found.add(`commit ${current} adds a ${name}`);
    }
    reasons.push(...[...found].slice(0, 5));
  }
  return { outcome: reasons.length ? "fail" : "pass", reasons };
};
