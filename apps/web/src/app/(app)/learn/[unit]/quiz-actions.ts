"use server";

import { revalidatePath } from "next/cache";
import { requireLearner } from "@/lib/auth/learner";
import { getUnit } from "@/lib/content/load";
import { cleanAnswers, markQuiz, type QuizResult } from "@/lib/quiz/mark";

export type QuizActionResult = { ok: true; result: QuizResult } | { ok: false; error: string };

/**
 * Marks a quiz on the server and keeps the attempt (insert only, with the quiz
 * version it was marked against). A pass sets the quiz's progress to quiz_passed.
 */
export async function submitQuiz(unitId: string, rawAnswers: unknown): Promise<QuizActionResult> {
  const { claims, supabase } = await requireLearner();
  const unit = typeof unitId === "string" ? getUnit(unitId) : null;
  if (!unit) return { ok: false, error: "This quiz does not exist." };

  const answers = cleanAnswers(unit.quiz, rawAnswers);
  if (Object.keys(answers).length === 0) return { ok: false, error: "Choose at least one answer first." };
  const result = markQuiz(unit.quiz, answers);

  const saved = await supabase.from("quiz_attempts").insert({
    user_id: claims.sub, item_slug: unit.quiz.id, answers, score: result.score, content_hash: unit.hashes.quiz,
  });
  if (saved.error) return { ok: false, error: "Your answers could not be saved. Try again." };

  if (result.passed) {
    const { data } = await supabase.from("progress").select("state").eq("item_slug", unit.quiz.id).maybeSingle();
    if (!data) await supabase.from("progress").insert({ user_id: claims.sub, item_slug: unit.quiz.id, state: "quiz_passed" });
    else if (data.state === "started" || data.state === "read") await supabase.from("progress").update({ state: "quiz_passed" }).eq("item_slug", unit.quiz.id);
  }
  revalidatePath(`/learn/${unit.meta.id}`);
  revalidatePath("/map");
  return { ok: true, result };
}
