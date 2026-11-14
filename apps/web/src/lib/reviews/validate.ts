/**
 * The self-review form, checked on the server (T22). Pure, so it is tested without a server.
 * The same limits are on the form (maxLength) and in the database (CHECK constraints).
 */
export const REVIEW_TEXT_MAX = 4000;

export type ReviewInput = {
  checklist: { items: { text: string; checked: boolean }[] };
  explanation: string;
  gpis_comparison: string;
};

type FormLike = { get(name: string): unknown };

export function readReviewForm(form: FormLike, items: string[]): { ok: true; value: ReviewInput } | { ok: false; error: string } {
  const explanation = String(form.get("explanation") ?? "").trim();
  const comparison = String(form.get("gpis_comparison") ?? "").trim();
  if (!explanation) return { ok: false, error: "Write your explanation first." };
  if (!comparison) return { ok: false, error: "Write your comparison with GPIS first." };
  if (explanation.length > REVIEW_TEXT_MAX) return { ok: false, error: `The explanation is too long: at most ${REVIEW_TEXT_MAX} characters.` };
  if (comparison.length > REVIEW_TEXT_MAX) return { ok: false, error: `The comparison is too long: at most ${REVIEW_TEXT_MAX} characters.` };
  // Only the items this unit's review.md lists; anything else in the form is ignored.
  const checklist = { items: items.map((text, i) => ({ text, checked: form.get(`item-${i}`) === "on" })) };
  return { ok: true, value: { checklist, explanation, gpis_comparison: comparison } };
}
