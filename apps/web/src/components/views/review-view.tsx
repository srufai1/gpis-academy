import Link from "next/link";

export type ShownRevision = {
  revision: number;
  when: string;
  checklist: { text: string; checked: boolean }[];
  explanation: string;
  comparison: string;
};

export type ReviewViewProps = {
  projectHref: string;
  label: string;
  title: string;
  /** False until a passing run of the current check version exists. */
  open: boolean;
  version: string;
  command: string;
  introHtml: string;
  masteryHtml: string;
  reflectionHtml: string;
  revisions: ShownRevision[];
  /** The form (a Client Component), given by the page; only shown when open. */
  form: React.ReactNode;
};

/** Self-review page (T22): the learner's own check, saved as revisions. */
export function ReviewView(p: ReviewViewProps) {
  return (
    <article className="mx-auto w-full min-w-0 max-w-3xl space-y-8">
      <header className="space-y-1">
        <Link href={p.projectHref} className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground">‹ {p.label} {p.title}</Link>
        <h1 className="text-xl font-semibold">Self-review</h1>
        <p className="font-medium">Your own check, not a mentor&apos;s.</p>
        {p.introHtml ? <div className="md text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: p.introHtml }} /> : null}
      </header>

      {p.open ? (
        <div data-slot="review-form">{p.form}</div>
      ) : (
        <section className="space-y-2 rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="font-semibold">Opens after a pass</h2>
          <p className="text-sm text-muted-foreground">
            The self-review opens when your work passes the current check (v{p.version}). Run <code>{p.command}</code> in your terminal.
          </p>
        </section>
      )}

      {p.masteryHtml ? <Fold title="Mastery check" html={p.masteryHtml} /> : null}
      {p.reflectionHtml ? <Fold title="Reflection" html={p.reflectionHtml} /> : null}

      <section aria-labelledby="revisions" className="space-y-2">
        <h2 id="revisions" className="font-semibold">Saved revisions</h2>
        {p.revisions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing saved yet.</p>
        ) : (
          <ul className="space-y-2">
            {p.revisions.map((r) => (
              <li key={r.revision}>
                <details className="rounded-xl border bg-card shadow-sm">
                  <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-2 px-4 py-2 font-medium">
                    Revision {r.revision} <span className="text-sm font-normal text-muted-foreground">· {r.when}</span>
                  </summary>
                  <div className="min-w-0 space-y-3 px-4 pb-4 text-sm">
                    {r.checklist.length > 0 ? (
                      <ul className="space-y-1">
                        {r.checklist.map((item, i) => (
                          <li key={i} className="break-words">{item.checked ? "☑" : "☐"} <span className="sr-only">{item.checked ? "ticked: " : "not ticked: "}</span>{item.text}</li>
                        ))}
                      </ul>
                    ) : null}
                    <div><p className="font-medium">Explanation</p><p className="whitespace-pre-wrap break-words text-muted-foreground">{r.explanation}</p></div>
                    <div><p className="font-medium">Comparison with GPIS</p><p className="whitespace-pre-wrap break-words text-muted-foreground">{r.comparison}</p></div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}

function Fold({ title, html }: { title: string; html: string }) {
  return (
    <details className="rounded-xl border bg-card shadow-sm">
      <summary className="flex min-h-11 cursor-pointer items-center px-4 font-medium">{title}</summary>
      <div className="md space-y-3 px-4 pb-4" dangerouslySetInnerHTML={{ __html: html }} />
    </details>
  );
}
