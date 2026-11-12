import Link from "next/link";
import { CheckCircle2, Circle, CircleDot } from "lucide-react";
import { RaisedRow } from "@/components/raised-row";
import { Button } from "@/components/ui/button";
import type { CourseItem, ModuleRow } from "@/lib/progress/summary";

const STATUS_ICON = {
  done: <CheckCircle2 className="size-5 text-primary" />,
  active: <CircleDot className="size-5 text-primary" />,
  "not-started": <Circle className="size-5 text-muted-foreground" />,
} as const;

function moduleLine(row: ModuleRow): string {
  if (row.projectsTotal === 0) return `${row.guidanceLabel} · ${row.weeks} weeks`;
  if (row.status === "not-started") return `${row.guidanceLabel} · ${row.weeks} weeks`;
  return `${row.projectsDone} of ${row.projectsTotal} projects`;
}

/** Course map (mockup 02): Continue first, then one raised row per module. */
export function MapView({ next, nextLine, modules, isNew }: {
  next: CourseItem | null; nextLine: string; modules: ModuleRow[]; isNew: boolean;
}) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">Course map</h1>
      {isNew && next ? (
        <section className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
          <p className="font-medium">Start with Module 1</p>
          <Button asChild size="lg" className="w-full sm:w-auto"><Link href={next.href}>Start</Link></Button>
        </section>
      ) : next ? (
        <section aria-labelledby="continue" className="space-y-2">
          <h2 id="continue" className="text-sm font-semibold text-muted-foreground">Continue</h2>
          <RaisedRow href={next.href} title={`${next.label} ${next.title}`} line={nextLine} className="border-primary/40" />
        </section>
      ) : (
        <p className="rounded-xl border bg-card p-4 shadow-sm">You have finished every item written so far.</p>
      )}
      <ul aria-label="Modules" className="grid grid-cols-1 gap-2">
        {modules.map((row) => (
          <li key={row.slug}>
            <RaisedRow href={`/map/${row.slug}`} title={`${row.label}  ${row.title}`} line={moduleLine(row)} icon={STATUS_ICON[row.status]}>
              {row.status === "active" && row.projectsTotal > 0 ? (
                <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar"
                  aria-label={`${row.projectsDone} of ${row.projectsTotal} projects`} aria-valuemin={0} aria-valuemax={row.projectsTotal} aria-valuenow={row.projectsDone}>
                  <span className="block h-full bg-primary" style={{ width: `${(row.projectsDone / row.projectsTotal) * 100}%` }} />
                </span>
              ) : null}
            </RaisedRow>
          </li>
        ))}
      </ul>
    </div>
  );
}
