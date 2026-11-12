import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { RaisedRow } from "@/components/raised-row";
import { isFinished, unitItems, type OutlineModule, type ProgressMap } from "@/lib/progress/summary";

const KIND_LABEL = { lesson: "Lesson", quiz: "Quiz", project: "Project" } as const;

/** One module: its units, each with lesson, quiz and project rows. Nothing is locked. */
export function ModuleView({ module, progress }: { module: OutlineModule; progress: ProgressMap }) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6">
      <div className="space-y-1">
        <Link href="/map" className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground">‹ Course map</Link>
        <h1 className="text-xl font-semibold">{module.label} {module.title}</h1>
        <p className="text-sm text-muted-foreground">{module.guidanceLabel} · {module.weeks} weeks</p>
      </div>
      {module.units.length === 0 ? (
        <p className="rounded-xl border bg-card p-4 shadow-sm">This module&apos;s units are not written yet. You can read the plan in the curriculum.</p>
      ) : module.units.map((unit) => (
        <section key={unit.id} aria-labelledby={`unit-${unit.id}`} className="space-y-2">
          <h2 id={`unit-${unit.id}`} className="text-sm font-semibold text-muted-foreground">{unit.label} {unit.title}</h2>
          <ul className="grid grid-cols-1 gap-2">
            {unitItems(module.slug, unit).map((item) => {
              const done = isFinished(item, progress);
              return (
                <li key={item.slug}>
                  <RaisedRow href={item.href} title={item.kind === "project" ? item.title : KIND_LABEL[item.kind]}
                    line={`${KIND_LABEL[item.kind]} · ${done ? "done" : "not done yet"}`}
                    icon={done ? <CheckCircle2 className="size-5 text-primary" /> : <Circle className="size-5 text-muted-foreground" />} />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
