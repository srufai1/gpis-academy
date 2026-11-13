import type { StepResult } from "@gpis-academy/shared/result-schema";

const LABEL = { pass: "PASS", fail: "FAIL", needs: "NEEDS", skipped: "SKIP" } as const;

/** The plain-text report of docs/checker.md: a header, one line per step, then the result. */
export function formatReport(check: { id: string; title: string; version: string }, steps: StepResult[], passed: boolean, sent: string): string {
  const lines = [`${check.id} · ${check.title} · check v${check.version}`];
  for (const step of steps) {
    lines.push(`  ${LABEL[step.outcome].padEnd(5)} ${step.kind.padEnd(7)} ${step.title}${step.required ? "" : " (optional)"}`);
    if (step.outcome !== "pass") for (const reason of step.reasons) lines.push(`          ${reason}`);
  }
  const needs = steps.some((s) => s.outcome === "needs");
  lines.push(`Result: ${passed ? "PASSED" : "NOT PASSED"} · ${sent}`);
  if (needs) lines.push("Some steps need something on this computer first (NEEDS). Run: npx academy doctor");
  return lines.join("\n");
}
