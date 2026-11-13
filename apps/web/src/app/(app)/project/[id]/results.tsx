import { Check, CircleAlert, Minus, X } from "lucide-react";
import type { RunView } from "@/lib/check-runs/read";
import { cn } from "@/lib/utils";

/** A recorded run with its time already written in the learner's time zone. */
export type ShownRun = RunView & { when: string };

const STEP_ICON = {
  pass: { Icon: Check, label: "Passed", className: "text-emerald-500" },
  fail: { Icon: X, label: "Failed", className: "text-red-500" },
  needs: { Icon: CircleAlert, label: "Needs something on your computer", className: "text-amber-500" },
  skipped: { Icon: Minus, label: "Skipped", className: "text-muted-foreground" },
} as const;

function verdict(run: ShownRun): string {
  if (!run.currentVersion) return run.passed ? `Passed an earlier version (v${run.version})` : `Not passed · earlier version (v${run.version})`;
  return run.passed ? "Passed" : "Not passed";
}

function commitLine(run: ShownRun): string {
  if (!run.commitSha) return "no commit";
  return `commit ${run.commitSha.slice(0, 7)}${run.treeClean === false ? " · with uncommitted changes" : ""}`;
}

/** The checker results on the project task page (mockup 04, T20). The page never runs a check. */
export function Results({ runs }: { runs: ShownRun[] }) {
  const [last, ...earlier] = runs;
  if (!last) {
    return <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground shadow-sm">No result yet. Run the command in your terminal.</p>;
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{last.when} · check v{last.version}</p>
      <div className="min-w-0 space-y-3 rounded-xl border bg-card p-4 shadow-sm">
        <p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className={cn("inline-flex items-center gap-1.5 font-semibold", last.passed && last.currentVersion ? "text-emerald-500" : last.passed ? "" : "text-red-500")}>
            {last.passed ? <Check aria-hidden="true" className="size-4" /> : <X aria-hidden="true" className="size-4" />}
            {verdict(last)}
          </span>
          <span className="text-sm text-muted-foreground">{commitLine(last)}</span>
        </p>
        {!last.currentVersion ? (
          <p className="text-sm text-muted-foreground">A newer version of this check is published. Run the command again to check your work against it.</p>
        ) : null}
        <ul className="space-y-2" aria-label="Steps">
          {last.steps.map((step) => {
            const { Icon, label, className } = STEP_ICON[step.outcome];
            return (
              <li key={step.id} className="min-w-0">
                <span className="flex min-w-0 items-start gap-2">
                  <Icon aria-label={label} role="img" className={cn("mt-0.5 size-4 shrink-0", className)} />
                  <span className="min-w-0 break-words">
                    <span className="text-sm text-muted-foreground">{step.kind}</span>{" "}
                    {step.title}
                    {step.required ? null : <span className="text-sm text-muted-foreground"> (optional)</span>}
                  </span>
                </span>
                {step.outcome !== "pass" && step.reasons.length > 0 ? (
                  <ul className="mt-1 space-y-1 pl-6 text-sm text-muted-foreground">
                    {step.reasons.map((reason, i) => <li key={i} className="break-words">{reason}</li>)}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
      {earlier.length > 0 ? (
        <details className="rounded-xl border bg-card shadow-sm">
          <summary className="flex min-h-11 cursor-pointer items-center px-4 font-medium">Earlier results · {earlier.length}</summary>
          <ul className="space-y-1 px-4 pb-4 text-sm">
            {earlier.map((run) => (
              <li key={run.id} className="flex flex-wrap justify-between gap-x-3">
                <span>{verdict(run)}</span>
                <span className="text-muted-foreground">{run.when} · {commitLine(run)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
