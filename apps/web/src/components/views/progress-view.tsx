import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { ProjectFacts } from "@/lib/progress/facts";

export type ProgressModule = { slug: string; title: string; label: string; projects: ProjectFacts[] };

const DONE = { done: "✓", active: "●", none: "○" } as const;
const DONE_TEXT = { done: "done", active: "in progress", none: "not started" } as const;
const fact = (v: boolean | null) => (v === null ? "–" : v ? "✓" : "✗");
const factText = (v: boolean | null, yes: string, no: string) => (v === null ? "not yet" : v ? yes : no);

/** Progress (mockup 05): two counts, then per project four separate facts. */
export function ProgressView({ modules, projectsDone, quizzesPassed, next }: {
  modules: ProgressModule[]; projectsDone: number; quizzesPassed: number; next: { href: string; label: string } | null;
}) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">Progress</h1>
      <dl className="grid grid-cols-2 gap-2">
        {[[projectsDone, "projects done"], [quizzesPassed, "quizzes passed"]].map(([n, label]) => (
          <div key={label} className="rounded-xl border bg-card p-3 text-center shadow-sm">
            <dt className="sr-only">{label}</dt>
            <dd className="text-2xl font-semibold">{n}</dd>
            <dd aria-hidden="true" className="text-xs text-muted-foreground">{label}</dd>
          </div>
        ))}
      </dl>

      {modules.map((m) => (
        <section key={m.slug} aria-labelledby={`p-${m.slug}`} className="space-y-2">
          <h2 id={`p-${m.slug}`} className="font-semibold">Module {m.label} · {m.title}</h2>
          <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
            <table className="w-full min-w-[20rem] text-sm">
              <thead className="text-left text-muted-foreground">
                <tr><th className="px-3 py-2 font-medium">Project</th><th className="px-2 py-2 text-center font-medium">Done</th><th className="px-2 py-2 text-center font-medium">Check</th><th className="px-2 py-2 text-center font-medium">Review</th><th className="px-2 py-2 text-center font-medium">Due</th></tr>
              </thead>
              <tbody>
                {m.projects.map((p) => (
                  <tr key={p.slug} className="border-t">
                    <td className="px-3 py-1"><Link href={`/project/${p.slug}`} className="flex min-h-11 items-center font-medium hover:underline">{p.label} {p.title}</Link></td>
                    <td className="px-2 text-center"><span aria-hidden="true">{DONE[p.done]}</span><span className="sr-only">{DONE_TEXT[p.done]}</span></td>
                    <td className="px-2 text-center"><span aria-hidden="true">{fact(p.checker)}</span><span className="sr-only">checker {factText(p.checker, "passed", "not passed")}</span></td>
                    <td className="px-2 text-center"><span aria-hidden="true">{fact(p.review)}</span><span className="sr-only">self-review {factText(p.review, "written", "not written")}</span></td>
                    <td className="px-2 text-center"><span aria-hidden="true">{fact(p.onTime)}</span><span className="sr-only">{factText(p.onTime, "on time", "late")}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <p className="text-sm text-muted-foreground">Review is your own check, not a mentor&apos;s. – means not yet.</p>

      {next ? <Button asChild size="lg" className="w-full sm:w-auto"><Link href={next.href}>Continue: {next.label}</Link></Button> : null}
    </div>
  );
}
