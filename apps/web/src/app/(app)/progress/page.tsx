import type { Metadata } from "next";
import { PageError } from "@/components/page-error";
import { ProgressView } from "@/components/views/progress-view";
import { requireLearner } from "@/lib/auth/learner";
import { getCourse } from "@/lib/content/load";
import { courseOutline } from "@/lib/content/outline";
import { projectFacts, type ProgressRow, type ReviewRow, type RunRow } from "@/lib/progress/facts";
import { nextItem } from "@/lib/progress/summary";

export const metadata: Metadata = { title: "Progress" };

type RunJoin = { passed: boolean; check_definitions: { item_slug: string; version: string } | null };

export default async function ProgressPage() {
  const { supabase } = await requireLearner();
  const [progress, runs, reviews] = await Promise.all([
    supabase.from("progress").select("item_slug, state, due_on, updated_at").limit(5000),
    supabase.from("check_runs").select("passed, check_definitions(item_slug, version)").limit(5000),
    supabase.from("reviews").select("item_slug").limit(5000),
  ]);
  if (progress.error || runs.error || reviews.error) return <PageError />;

  const rows = (progress.data ?? []) as ProgressRow[];
  const runRows: RunRow[] = ((runs.data ?? []) as unknown as RunJoin[])
    .filter((r) => r.check_definitions)
    .map((r) => ({ item_slug: r.check_definitions!.item_slug, version: r.check_definitions!.version, passed: r.passed }));
  const reviewRows = (reviews.data ?? []) as ReviewRow[];
  const now = new Date();
  const outline = courseOutline();
  const versions = new Map(getCourse().units.map((u) => [u.check.id, u.check.version]));

  const modules = outline.filter((m) => m.units.length > 0).map((m) => ({
    slug: m.slug, title: m.title, label: m.label,
    projects: m.units.map((u) => projectFacts({ slug: u.projectId, label: u.label, title: u.projectTitle, currentVersion: versions.get(u.projectId)! }, rows, runRows, reviewRows, now)),
  }));
  const state = Object.fromEntries(rows.map((r) => [r.item_slug, r.state]));
  const next = nextItem(outline, state);
  return (
    <ProgressView
      modules={modules}
      projectsDone={rows.filter((r) => r.state === "done" && outline.some((m) => m.units.some((u) => u.projectId === r.item_slug))).length}
      quizzesPassed={rows.filter((r) => r.state === "quiz_passed").length}
      next={next ? { href: next.href, label: `${next.label} ${next.title}` } : null}
    />
  );
}
