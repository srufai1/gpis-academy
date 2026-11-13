/**
 * Step kind "tests" (T15): run a command, or the course's test files, against the learner's work.
 *   run:   { command, cwd: lab|project, timeout_seconds, expect_exit, expect_stdout, expect_stdout_contains }
 *   files: ["tests/grading.test.mjs", …]   (in the check folder; run with node --test in the project)
 */
import { CheckerError } from "../errors.ts";
import { insideRoot } from "../safe-path.ts";
import type { StepKindImpl } from "../runner.ts";
import { runCommand, tail } from "./run.ts";

type Run = { command?: string; timeout_seconds?: number; expect_exit?: number; expect_stdout?: string; expect_stdout_contains?: string };

export const testsStep: StepKindImpl = async (step, ctx) => {
  const run = step.run as Run | undefined;
  const files = step.files as string[] | undefined;
  if (!run?.command && !files?.length) throw new CheckerError("a tests step needs run.command or files");

  if (files?.length) {
    const paths = files.map((f) => insideRoot(ctx.checkDir, f));
    const r = await runCommand(process.execPath, ["--test", "--test-reporter=tap", ...paths], {
      cwd: ctx.workDir, timeoutSeconds: (step.timeout_seconds as number | undefined) ?? 120, env: { ACADEMY_PROJECT: ctx.workDir },
    });
    if (r.timedOut) return { outcome: "fail", reasons: ["The tests took too long and were stopped (an endless loop?)"] };
    if (r.tooMuchOutput) return { outcome: "fail", reasons: ["The tests printed too much output and were stopped"] };
    const pass = Number(/^# pass (\d+)/m.exec(r.stdout)?.[1] ?? 0);
    const fail = Number(/^# fail (\d+)/m.exec(r.stdout)?.[1] ?? 0);
    if (r.code === 0 && fail === 0) return { outcome: "pass", reasons: [`${pass} of ${pass} passed`] };
    const failed = [...r.stdout.matchAll(/^not ok \d+ - (.+)$/gm)].map((m) => m[1]!).slice(0, 4);
    return { outcome: "fail", reasons: [`${pass} of ${pass + fail} passed`, ...failed.map((f) => `failed: ${f}`)] };
  }

  const r = await runCommand("bash", ["-c", run!.command!], { cwd: ctx.workDir, timeoutSeconds: run!.timeout_seconds ?? 30 });
  if (r.missing) return { outcome: "needs", reasons: ["bash is not installed"] };
  if (r.timedOut) return { outcome: "fail", reasons: [`"${run!.command}" took longer than ${run!.timeout_seconds ?? 30} s and was stopped`] };
  if (r.tooMuchOutput) return { outcome: "fail", reasons: [`"${run!.command}" printed too much output and was stopped`] };
  const reasons: string[] = [];
  const wantExit = run!.expect_exit ?? 0;
  if (r.code !== wantExit) reasons.push(`"${run!.command}" ended with code ${r.code}, expected ${wantExit}`, ...tail(r.stderr, 2));
  if (run!.expect_stdout !== undefined && r.stdout !== run!.expect_stdout) reasons.push(`it printed ${JSON.stringify(r.stdout.slice(0, 80))}, expected ${JSON.stringify(run!.expect_stdout)}`);
  if (run!.expect_stdout_contains !== undefined && !r.stdout.includes(run!.expect_stdout_contains)) reasons.push(`its output does not contain ${JSON.stringify(run!.expect_stdout_contains)}`);
  return { outcome: reasons.length ? "fail" : "pass", reasons };
};
