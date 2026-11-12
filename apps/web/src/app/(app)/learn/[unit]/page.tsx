import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageError } from "@/components/page-error";
import { LessonView } from "@/components/views/lesson-view";
import { requireLearner } from "@/lib/auth/learner";
import { getUnit, moduleOfUnit, publicQuiz } from "@/lib/content/load";
import { renderMarkdown } from "@/lib/content/markdown";
import { stripTitle } from "@/lib/content/sections";
import { readProgress } from "@/lib/progress/read";
import { Quiz, type LastAttempt } from "./quiz";
import { submitQuiz } from "./quiz-actions";
import { ReadButton } from "./read-button";

type Props = { params: Promise<{ unit: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const unit = getUnit((await params).unit);
  return { title: unit ? unit.meta.title : "Lesson" };
}

export default async function LessonPage({ params }: Props) {
  const { supabase } = await requireLearner();
  const unit = getUnit((await params).unit);
  if (!unit) notFound();
  const progress = await readProgress(supabase);
  if (!progress) return <PageError />;
  const attempt = await supabase.from("quiz_attempts").select("score, content_hash").eq("item_slug", unit.quiz.id)
    .order("id", { ascending: false }).limit(1).maybeSingle();
  if (attempt.error) return <PageError />;
  const last: LastAttempt = attempt.data
    ? { score: attempt.data.score, total: unit.quiz.questions.length, passed: attempt.data.score >= unit.quiz.pass_mark, changed: attempt.data.content_hash !== unit.hashes.quiz }
    : null;
  const unitId = unit.meta.id;
  const mod = moduleOfUnit(unit);
  const state = progress[unit.meta.id];
  const read = state === "read" || state === "quiz_passed" || state === "done";
  return (
    <LessonView
      moduleHref={`/map/${mod.slug}`}
      moduleLabel={`Module ${mod.label ?? mod.number}`}
      label={`${mod.label ?? mod.number}.${unit.meta.position}`}
      title={unit.meta.title}
      lessonHtml={renderMarkdown(stripTitle(unit.lesson))}
      exampleHtml={renderMarkdown(unit.example)}
      gpisPart={unit.meta.gpis_part}
      read={read}
      readForm={<ReadButton unitId={unitId} read={read} />}
      quiz={<Quiz quiz={publicQuiz(unit)} last={last} labHref={`/project/${unit.check.id}`} submit={submitQuiz.bind(null, unitId)} />}
    />
  );
}
