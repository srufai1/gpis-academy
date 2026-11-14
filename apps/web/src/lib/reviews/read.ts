/** Reading a learner's self-reviews and whether the review may open (T22). Runs as the learner: RLS, own rows only. */
import type { SupabaseClient } from "@supabase/supabase-js";

export type ReviewRevision = {
  revision: number;
  createdAt: string;
  checklist: { text: string; checked: boolean }[];
  explanation: string;
  comparison: string;
};

/** Stored checklist JSON → items, defensively (never trusted as-is for display). */
export function checklistOf(value: unknown): { text: string; checked: boolean }[] {
  const items = (value as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return [];
  return items.flatMap((i) => {
    const o = i as Record<string, unknown>;
    return typeof o?.text === "string" && typeof o.checked === "boolean" ? [{ text: o.text.slice(0, 300), checked: o.checked }] : [];
  });
}

/** Every revision for this project, newest first. Throws on a database error. */
export async function readRevisions(supabase: SupabaseClient, projectId: string): Promise<ReviewRevision[]> {
  const { data, error } = await supabase.from("reviews").select("revision, created_at, checklist, explanation, gpis_comparison")
    .eq("item_slug", projectId).order("revision", { ascending: false }).limit(100);
  if (error) throw new Error(`reviews read failed: ${error.code}`);
  return (data ?? []).map((r) => ({
    revision: Number(r.revision), createdAt: r.created_at as string, checklist: checklistOf(r.checklist),
    explanation: r.explanation as string, comparison: r.gpis_comparison as string,
  }));
}

/** True when the learner has a passing run of THIS version of the check. Throws on a database error. */
export async function hasCurrentPass(supabase: SupabaseClient, projectId: string, version: string): Promise<boolean> {
  const { data, error } = await supabase.from("check_runs").select("id, check_definitions!inner(item_slug, version)")
    .eq("passed", true).eq("check_definitions.item_slug", projectId).eq("check_definitions.version", version).limit(1);
  if (error) throw new Error(`check_runs read failed: ${error.code}`);
  return (data ?? []).length > 0;
}
