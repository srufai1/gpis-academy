/**
 * Progress facts (T11). Pure. Four separate facts per project, never merged into
 * one score: done, checker, self-review, on time. null means "not yet" ("–"),
 * never zero or false.
 */
import type { ProgressState } from "./summary";

export type ProjectRef = { slug: string; label: string; title: string; currentVersion: string };
export type ProgressRow = { item_slug: string; state: ProgressState; due_on: string | null; updated_at: string };
export type RunRow = { item_slug: string; version: string; passed: boolean };
export type ReviewRow = { item_slug: string };

export type Done = "done" | "active" | "none";
export type ProjectFacts = {
  slug: string; label: string; title: string;
  done: Done;
  /** true: a passing run of the CURRENT check version; false: runs of it, none passing; null: no run of it. */
  checker: boolean | null;
  /** The learner's own self-review exists (not a mentor's). */
  review: boolean | null;
  /** true: done by the due date; false: due date passed and not done; null: no due date or not due yet. */
  onTime: boolean | null;
};

export function projectFacts(project: ProjectRef, progress: ProgressRow[], runs: RunRow[], reviews: ReviewRow[], now: Date): ProjectFacts {
  const row = progress.find((p) => p.item_slug === project.slug);
  const done: Done = row?.state === "done" ? "done" : row ? "active" : "none";
  const current = runs.filter((r) => r.item_slug === project.slug && r.version === project.currentVersion);
  const checker = current.length === 0 ? null : current.some((r) => r.passed);
  const review = reviews.some((r) => r.item_slug === project.slug) ? true : null;
  let onTime: boolean | null = null;
  if (row?.due_on) {
    const due = new Date(row.due_on).getTime();
    if (done === "done") onTime = new Date(row.updated_at).getTime() <= due;
    else if (now.getTime() > due) onTime = false;
  }
  return { slug: project.slug, label: project.label, title: project.title, done, checker, review, onTime };
}
