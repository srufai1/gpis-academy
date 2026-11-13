/**
 * Step kind "static" (T15): the project's own lint, type check and build, when it has them.
 *   run: [lint, tsc, build]   (default: all three); timeout_seconds per command
 * A command the project does not have is reported, not failed; none at all is "skipped".
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { StepKindImpl } from "../runner.ts";
import { runCommand, tail } from "./run.ts";

const COMMANDS = ["lint", "tsc", "build"] as const;

export const staticStep: StepKindImpl = async (step, ctx) => {
  const wanted = ((step.run as string[] | undefined) ?? [...COMMANDS]).filter((c): c is (typeof COMMANDS)[number] => (COMMANDS as readonly string[]).includes(c));
  const pkgPath = join(ctx.workDir, "package.json");
  const scripts: Record<string, string> = existsSync(pkgPath) ? (JSON.parse(readFileSync(pkgPath, "utf8")).scripts ?? {}) : {};
  const plan: { name: string; cmd: string; args: string[] }[] = [];
  for (const c of wanted) {
    if (c === "lint" && scripts.lint) plan.push({ name: "lint", cmd: "npm", args: ["run", "--silent", "lint"] });
    if (c === "tsc" && existsSync(join(ctx.workDir, "tsconfig.json"))) plan.push({ name: "tsc", cmd: "npx", args: ["--no-install", "tsc", "--noEmit"] });
    if (c === "build" && scripts.build) plan.push({ name: "build", cmd: "npm", args: ["run", "--silent", "build"] });
  }
  if (plan.length === 0) return { outcome: "skipped", reasons: ["The project has no lint, tsc or build to run"] };

  const reasons: string[] = [];
  const passed: string[] = [];
  for (const p of plan) {
    const r = await runCommand(p.cmd, p.args, { cwd: ctx.workDir, timeoutSeconds: (step.timeout_seconds as number | undefined) ?? 300 });
    if (r.missing) return { outcome: "needs", reasons: [`${p.cmd} is not installed`] };
    if (r.timedOut) reasons.push(`${p.name} took too long and was stopped`);
    else if (r.tooMuchOutput) reasons.push(`${p.name} printed too much output and was stopped`);
    else if (r.code !== 0) reasons.push(`${p.name} failed`, ...tail(`${r.stdout}\n${r.stderr}`, 2));
    else passed.push(p.name);
  }
  return reasons.length ? { outcome: "fail", reasons } : { outcome: "pass", reasons: [passed.join(", ")] };
};
