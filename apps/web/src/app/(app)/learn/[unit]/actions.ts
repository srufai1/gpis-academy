"use server";

import { revalidatePath } from "next/cache";
import { requireLearner } from "@/lib/auth/learner";
import { getUnit } from "@/lib/content/load";

export type ReadState = { error?: string; done?: boolean };

/** Records that the learner has read a lesson. Never lowers a later state (quiz passed, done). */
export async function markRead(unitId: string): Promise<ReadState> {
  const { claims, supabase } = await requireLearner();
  if (typeof unitId !== "string" || !getUnit(unitId)) return { error: "This lesson does not exist." };

  const { data, error } = await supabase.from("progress").select("state").eq("item_slug", unitId).maybeSingle();
  if (error) return { error: "Your progress could not be saved. Try again." };
  if (data && data.state !== "started") return { done: true };

  const write = data
    ? await supabase.from("progress").update({ state: "read" }).eq("item_slug", unitId)
    : await supabase.from("progress").insert({ user_id: claims.sub, item_slug: unitId, state: "read" });
  if (write.error) return { error: "Your progress could not be saved. Try again." };
  revalidatePath(`/learn/${unitId}`);
  return { done: true };
}
