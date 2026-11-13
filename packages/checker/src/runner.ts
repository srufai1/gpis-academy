/**
 * Runs a check's steps in order (T13). Step kinds are plug-ins (T14–T16).
 * A step returns an outcome and short reasons; an unknown kind or a broken step
 * definition is a checker error (exit 2), never a pass.
 */
import { LIMITS, passedFromSteps, type StepKind, type StepOutcome, type StepResult } from "@gpis-academy/shared/result-schema";
import { CheckerError } from "./errors.ts";

export type StepContext = {
  /** The folder being checked: the lab folder, or the learner's project. */
  workDir: string;
  /** The check's own folder (fixtures, tests). */
  checkDir: string;
  /** Opens the lab database (tests pass PGlite; the CLI uses pg). */
  connect?: (connectionString: string) => Promise<SqlClient>;
};
export type SqlClient = {
  exec(sql: string): Promise<unknown>;
  query(sql: string): Promise<{ rows: Record<string, unknown>[] }>;
  end(): Promise<void>;
};
export type StepDefinition = Record<string, unknown> & { id: string; kind: string; title: string; required: boolean };
export type StepOutput = { outcome: StepOutcome; reasons?: string[] };
export type StepKindImpl = (step: StepDefinition, ctx: StepContext) => Promise<StepOutput> | StepOutput;
export type StepKinds = Readonly<Record<string, StepKindImpl>>;

/** One short line per reason: no line breaks, cut to the protocol's length. */
export function cleanReason(text: string): string {
  const line = String(text).replace(/[\u0000-\u001F\u007F\u2028\u2029]+/g, " ").replace(/\s+/g, " ").trim();
  return line.length > LIMITS.reasonChars ? `${line.slice(0, LIMITS.reasonChars - 1)}…` : line || "(no detail)";
}

export async function runSteps(steps: StepDefinition[], ctx: StepContext, kinds: StepKinds, messages: Record<string, string> = {}) {
  if (steps.length > LIMITS.steps) throw new CheckerError(`A check may have at most ${LIMITS.steps} steps.`);
  const results: StepResult[] = [];
  for (const step of steps) {
    const impl = kinds[step.kind];
    if (!impl) throw new CheckerError(`Step "${step.id}" uses the kind "${step.kind}", which this checker does not know. Update the checker.`);
    let out: StepOutput;
    try {
      out = await impl(step, ctx);
    } catch (error) {
      if (error instanceof CheckerError) throw new CheckerError(`Step "${step.id}": ${error.message}`);
      throw error;
    }
    const own = (out.reasons ?? []).map(cleanReason);
    const message = out.outcome === "fail" && messages[step.id] ? [cleanReason(messages[step.id]!)] : [];
    const reasons = [...message, ...own].slice(0, LIMITS.reasonsPerStep);
    results.push({ id: step.id, kind: step.kind as StepKind, title: cleanReason(step.title).slice(0, LIMITS.titleChars), required: step.required, outcome: out.outcome, reasons });
  }
  return { steps: results, passed: passedFromSteps(results) };
}
