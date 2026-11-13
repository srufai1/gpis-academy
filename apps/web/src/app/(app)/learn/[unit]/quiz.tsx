"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import type { PublicQuiz } from "@ruftech-academy/shared/content-schema";
import { Button } from "@/components/ui/button";
import type { QuizResult } from "@/lib/quiz/mark";
import type { QuizActionResult } from "./quiz-actions";

export type LastAttempt = { score: number; total: number; passed: boolean; changed: boolean } | null;

/**
 * Quiz (mockup 03, bottom half). It receives questions without answers; the
 * server marks and returns the score and the reasons.
 */
export function Quiz({ quiz, last, labHref, submit }: {
  quiz: PublicQuiz; last: LastAttempt; labHref: string;
  submit: (answers: Record<string, number>) => Promise<QuizActionResult>;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const marked = new Map(result?.questions.map((q) => [q.id, q]) ?? []);

  const check = () => start(async () => {
    setError("");
    const reply = await submit(answers);
    if (reply.ok) setResult(reply.result);
    else setError(reply.error);
  });
  const again = () => { setResult(null); setAnswers({}); };

  return (
    <section id="quiz" aria-labelledby="quiz-title" className="space-y-4 border-t pt-6">
      <div className="space-y-1">
        <h2 id="quiz-title" className="text-lg font-semibold">Quiz · {quiz.questions.length} questions</h2>
        {result ? (
          <p role="status" className="font-medium">{result.score} of {result.total} · {result.passed ? "passed" : `pass mark ${result.passMark}`}</p>
        ) : last ? (
          <p className="text-sm text-muted-foreground">
            Last attempt: {last.score} of {last.total}{last.passed ? " · passed" : ""}{last.changed ? " (the quiz has changed since)" : ""}
          </p>
        ) : null}
      </div>

      <ol className="space-y-6">
        {quiz.questions.map((q, i) => {
          const mark = marked.get(q.id);
          return (
            <li key={q.id}>
              <fieldset className="space-y-2" disabled={!!result || pending}>
                <legend className="mb-2 font-medium">{i + 1}. {q.prompt}</legend>
                {q.options.map((option, k) => (
                  <label key={k} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border bg-card px-3 has-[:checked]:border-primary">
                    <input type="radio" name={q.id} value={k} checked={answers[q.id] === k}
                      onChange={() => setAnswers((a) => ({ ...a, [q.id]: k }))} className="size-4 accent-[var(--primary)]" />
                    <span className="min-w-0">{option}</span>
                  </label>
                ))}
                {mark ? (
                  <p className={`flex gap-2 text-sm ${mark.correct ? "" : "text-destructive"}`}>
                    {mark.correct ? <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /> : <XCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
                    <span><span className="sr-only">{mark.correct ? "Right. " : "Wrong. "}</span>{mark.reason}</span>
                  </p>
                ) : null}
              </fieldset>
            </li>
          );
        })}
      </ol>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {!result ? (
        <Button type="button" size="lg" className="w-full sm:w-auto" onClick={check} disabled={pending} aria-busy={pending || undefined}>
          {pending ? "Checking…" : "Check answers"}
        </Button>
      ) : result.passed ? (
        <div className="flex flex-wrap gap-2">
          <Button asChild size="lg"><Link href={labHref}>Next: lab</Link></Button>
          <Button type="button" variant="outline" onClick={again}>Try again</Button>
        </div>
      ) : (
        <Button type="button" size="lg" onClick={again}>Try again</Button>
      )}
    </section>
  );
}
