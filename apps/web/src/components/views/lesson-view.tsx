import Link from "next/link";

export type LessonViewProps = {
  moduleHref: string;
  moduleLabel: string;
  title: string;
  label: string;
  lessonHtml: string;
  exampleHtml: string;
  gpisPart: string;
  read: boolean;
  /** The mark-as-read form, given by the page (a Server Action). */
  readForm?: React.ReactNode;
  /** The quiz, given by the page (T09). */
  quiz?: React.ReactNode;
};

/**
 * Lesson page (mockup 03, top half): the lesson, the guided example, the GPIS
 * pointer folded until the learner has tried, then the quiz.
 * The HTML comes from renderMarkdown(), which escapes raw HTML.
 */
export function LessonView(props: LessonViewProps) {
  return (
    <article className="mx-auto w-full min-w-0 max-w-3xl space-y-8">
      <header className="space-y-1">
        <Link href={props.moduleHref} className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground">‹ {props.moduleLabel}</Link>
        <h1 className="text-xl font-semibold">{props.label} {props.title}</h1>
        <p className="text-sm text-muted-foreground">Lesson{props.read ? " · read" : ""}</p>
      </header>
      <section aria-label="Lesson" className="md" dangerouslySetInnerHTML={{ __html: props.lessonHtml }} />
      <section aria-label="Guided example" className="md border-t pt-6" dangerouslySetInnerHTML={{ __html: props.exampleHtml }} />
      <details className="rounded-xl border bg-card px-4 shadow-sm">
        <summary className="flex min-h-11 cursor-pointer items-center font-medium">In GPIS</summary>
        <p className="pb-4 text-sm text-muted-foreground">{props.gpisPart}. Open it after your own attempt.</p>
      </details>
      {props.readForm}
      {props.quiz}
    </article>
  );
}
