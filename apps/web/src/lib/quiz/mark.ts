/**
 * Quiz marking (T09). Pure. Runs only on the server: it needs the answers.
 * An unanswered or invalid answer counts as wrong; unknown question ids are ignored.
 */
import type { Quiz } from "@gpis-academy/shared/content-schema";

export type MarkedQuestion = { id: string; chosen: number | null; correct: boolean; reason: string };
export type QuizResult = { score: number; total: number; passMark: number; passed: boolean; questions: MarkedQuestion[] };
export type Answers = Record<string, number>;

/** Keeps only whole-number answers for this quiz's questions, inside each question's options. */
export function cleanAnswers(quiz: Quiz, raw: unknown): Answers {
  const answers: Answers = {};
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return answers;
  for (const q of quiz.questions) {
    const value = (raw as Record<string, unknown>)[q.id];
    if (Number.isInteger(value) && (value as number) >= 0 && (value as number) < q.options.length) answers[q.id] = value as number;
  }
  return answers;
}

export function markQuiz(quiz: Quiz, answers: Answers): QuizResult {
  const questions = quiz.questions.map((q) => {
    const chosen = Number.isInteger(answers[q.id]) ? answers[q.id]! : null;
    const correct = chosen === q.answer;
    const reason = correct ? q.why : chosen === null ? `Not answered. ${q.why}` : (q.wrong[String(chosen)] ?? q.why);
    return { id: q.id, chosen, correct, reason };
  });
  const score = questions.filter((q) => q.correct).length;
  return { score, total: quiz.questions.length, passMark: quiz.pass_mark, passed: score >= quiz.pass_mark, questions };
}
