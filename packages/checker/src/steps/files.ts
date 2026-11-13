/**
 * Step kind "files" (T14): checks paths in the project. Only reads.
 *   expect: - { path, type: file|directory|symlink|absent, mode, mode_any_of, target, resolves, sha256_of }
 *           - { glob, type: absent }     (or type file/directory: at least one match)
 */
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readlinkSync, statSync } from "node:fs";
import { CheckerError } from "../errors.ts";
import { insideRoot } from "../safe-path.ts";
import type { StepKindImpl } from "../runner.ts";
import { globFiles } from "./glob.ts";

type Expect = { path?: string; glob?: string; type?: string; mode?: string; mode_any_of?: string[]; target?: string; resolves?: boolean; sha256_of?: string };
const TYPES = ["file", "directory", "symlink", "absent"];
const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const modeOf = (path: string) => (lstatSync(path).mode & 0o777).toString(8).padStart(3, "0");

function checkOne(e: Expect, workDir: string, checkDir: string): string[] {
  if (e.type && !TYPES.includes(e.type)) throw new CheckerError(`type must be one of ${TYPES.join(", ")}`);
  if (e.glob !== undefined) {
    if (typeof e.glob !== "string" || e.glob.startsWith("/") || e.glob.split("/").includes("..")) throw new CheckerError(`glob "${String(e.glob)}" must stay inside the project`);
    const hits = globFiles(workDir, e.glob);
    if (e.type === "absent") return hits.length ? [`${hits.slice(0, 3).join(", ")}${hits.length > 3 ? ` and ${hits.length - 3} more` : ""} should not exist`] : [];
    return hits.length ? [] : [`nothing matches ${e.glob}`];
  }
  if (typeof e.path !== "string") throw new CheckerError("each expect entry needs a path or a glob");
  const full = insideRoot(workDir, e.path);
  // The check's own fixture path is checked first: a bad check definition is always an error.
  const expected = e.sha256_of !== undefined ? insideRoot(checkDir, e.sha256_of) : null;
  let st: ReturnType<typeof lstatSync> | null = null;
  try { st = lstatSync(full); } catch { st = null; }
  if (e.type === "absent") return st ? [`${e.path} should not exist`] : [];
  if (!st) return [`${e.path} is missing`];

  const problems: string[] = [];
  const kind = st.isSymbolicLink() ? "symlink" : st.isDirectory() ? "directory" : st.isFile() ? "file" : "other";
  if (e.type && kind !== e.type) return [`${e.path} is a ${kind}, not a ${e.type}`];
  if (e.mode !== undefined && modeOf(full) !== e.mode) problems.push(`${e.path} has mode ${modeOf(full)}, not ${e.mode}`);
  if (e.mode_any_of !== undefined && !e.mode_any_of.includes(modeOf(full))) problems.push(`${e.path} has mode ${modeOf(full)}`);
  if (e.target !== undefined && kind === "symlink" && readlinkSync(full).replace(/\/$/, "") !== e.target.replace(/\/$/, "")) {
    problems.push(`${e.path} points to ${readlinkSync(full)}, not ${e.target}`);
  }
  if (e.resolves) {
    let opens = false;
    try { insideRoot(workDir, e.path, { followLinks: true }); opens = existsSync(full); } catch { opens = false; }
    if (!opens) problems.push(`${e.path} does not open (broken, or points outside the project)`);
  }
  if (expected !== null) {
    let real: string;
    try { real = insideRoot(workDir, e.path, { followLinks: true }); } catch { return [...problems, `${e.path} points outside the project`]; }
    if (!statSync(real).isFile() || sha(real) !== sha(expected)) problems.push(`${e.path} does not have the expected content`);
  }
  return problems;
}

export const filesStep: StepKindImpl = (step, ctx) => {
  const expect = step.expect;
  if (!Array.isArray(expect) || expect.length === 0) throw new CheckerError("a files step needs a list under expect");
  const reasons = expect.flatMap((e) => checkOne(e as Expect, ctx.workDir, ctx.checkDir));
  return { outcome: reasons.length ? "fail" : "pass", reasons };
};
