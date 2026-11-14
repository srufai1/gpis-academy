"use server";

import { revalidatePath } from "next/cache";
import { requireLearner } from "@/lib/auth/learner";
import { getUnitByProject } from "@/lib/content/load";
import { hasCurrentPass } from "@/lib/reviews/read";
import { reviewContent } from "@/lib/reviews/content";
import { readReviewForm } from "@/lib/reviews/validate";

export type ReviewFormState = { error?: string; saved?: number };

const PROJECT_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Save a self-review (T22): always a NEW revision, never a change to an old one.
 * Checked here again, whatever the page showed: signed in, a known project, a passing run of
 * the current check version, and the text limits. The database checks the limits a third time.
 */
export async function saveReview(projectId: string, _state: ReviewFormState, form: FormData): Promise<ReviewFormState> {
  if (!PROJECT_ID.test(projectId)) return { error: "This project does not exist." };
  const unit = getUnitByProject(projectId);
  if (!unit) return { error: "This project does not exist." };
  const { claims, supabase } = await requireLearner();
  const input = readReviewForm(form, reviewContent(unit.review).checklist);
  if (!input.ok) return { error: input.error };
  try {
    if (!(await hasCurrentPass(supabase, projectId, unit.check.version))) {
      return { error: `The self-review opens after your work passes the current check (v${unit.check.version}).` };
    }
  } catch {
    return { error: "Something went wrong. Please try again." };
  }
  const { data, error } = await supabase.from("reviews")
    .insert({ user_id: claims.sub, item_slug: projectId, ...input.value })
    .select("revision").single();
  if (error || !data) {
    console.error("saveReview:", error?.code ?? "no row");
    return { error: "Your review was not saved. Please try again." };
  }
  revalidatePath(`/project/${projectId}/review`);
  revalidatePath(`/project/${projectId}`);
  revalidatePath("/progress");
  return { saved: Number(data.revision) };
}
