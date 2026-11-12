import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProgressMap, ProgressState } from "./summary";

/** The signed-in learner's progress rows (RLS returns only their own). Null when it cannot be read. */
export async function readProgress(supabase: SupabaseClient): Promise<ProgressMap | null> {
  const { data, error } = await supabase.from("progress").select("item_slug, state").limit(5000);
  if (error) return null;
  return Object.fromEntries((data ?? []).map((r: { item_slug: string; state: ProgressState }) => [r.item_slug, r.state]));
}
