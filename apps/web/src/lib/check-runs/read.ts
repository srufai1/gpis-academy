/**
 * Reading recorded checker results (T20). Pure mapping first, so the views and the tests need
 * no database; then one query, run as the learner (RLS: own rows only).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { STEP_KINDS } from "@ruftech-academy/shared/content-schema";
import { STEP_OUTCOMES, type StepResult } from "@ruftech-academy/shared/result-schema";

export type RunView = {
  id: number;
  checkId: string;
  version: string;
  /** False when a newer version of the check is published: "passed an earlier version". */
  currentVersion: boolean;
  passed: boolean;
  commitSha: string | null;
  treeClean: boolean | null;
  checkerVersion: string;
  /** ISO time the platform recorded it. */
  recordedAt: string;
  steps: StepResult[];
};

export type RunRow = {
  id: number | string;
  passed: boolean;
  commit_sha: string | null;
  tree_clean: boolean | null;
  checker_version: string;
  created_at: string;
  results: unknown;
  check_definitions: { item_slug: string; version: string } | null;
};

/** The steps stored with a run, defensively: anything malformed is left out, never shown raw. */
export function stepsOf(results: unknown): StepResult[] {
  const steps = (results as { steps?: unknown } | null)?.steps;
  if (!Array.isArray(steps)) return [];
  return steps.flatMap((s): StepResult[] => {
    const o = s as Record<string, unknown>;
    if (typeof o?.id !== "string" || typeof o.title !== "string" || typeof o.required !== "boolean"
      || !(STEP_KINDS as readonly unknown[]).includes(o.kind) || !(STEP_OUTCOMES as readonly unknown[]).includes(o.outcome)) return [];
    const reasons = Array.isArray(o.reasons) ? o.reasons.filter((r): r is string => typeof r === "string").slice(0, 5) : [];
    return [{ id: o.id, kind: o.kind as StepResult["kind"], title: o.title, required: o.required, outcome: o.outcome as StepResult["outcome"], reasons }];
  });
}

/** Rows (newest first) → views. `currentVersions` maps a check id to its newest published version. */
export function toRunViews(rows: RunRow[], currentVersions: ReadonlyMap<string, string>): RunView[] {
  return rows.filter((r) => r.check_definitions).map((r) => ({
    id: Number(r.id),
    checkId: r.check_definitions!.item_slug,
    version: r.check_definitions!.version,
    currentVersion: currentVersions.get(r.check_definitions!.item_slug) === r.check_definitions!.version,
    passed: r.passed,
    commitSha: r.commit_sha,
    treeClean: r.tree_clean,
    checkerVersion: r.checker_version,
    recordedAt: r.created_at,
    steps: stepsOf(r.results),
  }));
}

const COLUMNS = "id, passed, commit_sha, tree_clean, checker_version, created_at, results, check_definitions!inner(item_slug, version)";

/** The learner's newest runs, of one check or of all. Throws on a database error. */
export async function readRuns(supabase: SupabaseClient, options: { checkId?: string; limit: number }): Promise<RunRow[]> {
  let query = supabase.from("check_runs").select(COLUMNS).order("id", { ascending: false }).limit(options.limit);
  if (options.checkId) query = query.eq("check_definitions.item_slug", options.checkId);
  const { data, error } = await query;
  if (error) throw new Error(`check_runs read failed: ${error.code}`);
  return (data ?? []) as unknown as RunRow[];
}

/** The newest published version of each check (by id, as published). */
export async function currentVersions(supabase: SupabaseClient, checkIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (checkIds.length === 0) return map;
  const { data, error } = await supabase.from("check_definitions").select("item_slug, version, id").in("item_slug", checkIds).order("id", { ascending: false });
  if (error) throw new Error(`check_definitions read failed: ${error.code}`);
  for (const row of data ?? []) if (!map.has(row.item_slug as string)) map.set(row.item_slug as string, row.version as string);
  return map;
}

/** "13 Nov, 20:45" in the learner's time zone (profiles.time_zone); UTC when that zone is unknown. */
export function formatWhen(iso: string, timeZone: string): string {
  const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" };
  try {
    return new Intl.DateTimeFormat("en-GB", { ...options, timeZone }).format(new Date(iso));
  } catch {
    return `${new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(new Date(iso))} UTC`;
  }
}
