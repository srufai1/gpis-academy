import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CopyCommand } from "@/components/copy-command";
import { PageError } from "@/components/page-error";
import { ProjectView } from "@/components/views/project-view";
import { requireLearner } from "@/lib/auth/learner";
import { getUnitByProject, moduleOfUnit } from "@/lib/content/load";
import { renderMarkdown } from "@/lib/content/markdown";
import { countItems, projectParts } from "@/lib/content/sections";
import { formatWhen, readRuns, toRunViews } from "@/lib/check-runs/read";
import { Results } from "./results";
import { ReviewLink } from "./review-link";

type Props = { params: Promise<{ id: string }> };

const GUIDANCE_LABEL = { guided: "Guided", half: "Half guided", independent: "Independent" } as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const unit = getUnitByProject((await params).id);
  return { title: unit ? unit.check.title : "Project" };
}

export default async function ProjectPage({ params }: Props) {
  const { claims, supabase } = await requireLearner();
  const unit = getUnitByProject((await params).id);
  if (!unit) notFound();
  // Results as the learner (RLS: own rows only). The current version is the one this site ships.
  const [runRows, profile, reviews] = await Promise.all([
    readRuns(supabase, { checkId: unit.check.id, limit: 20 }).catch(() => null),
    supabase.from("profiles").select("time_zone").eq("id", claims.sub).maybeSingle(),
    supabase.from("reviews").select("revision", { count: "exact", head: true }).eq("item_slug", unit.check.id),
  ]);
  if (!runRows || reviews.error) return <PageError />;
  const timeZone = (profile.data?.time_zone as string | undefined) ?? "Africa/Accra";
  const runs = toRunViews(runRows, new Map([[unit.check.id, unit.check.version]])).map((r) => ({ ...r, when: formatWhen(r.recordedAt, timeZone) }));
  const mod = moduleOfUnit(unit);
  const parts = projectParts(unit.lab, unit.meta.guidance);
  const fold = (s: { body: string } | null) => (s ? { count: countItems(s.body), html: renderMarkdown(s.body) } : null);
  // Mockup 04: after a pass of the current version, the self-review is the main action.
  const passedNow = runs.some((r) => r.passed && r.currentVersion);
  return (
    <ProjectView
      moduleHref={`/map/${mod.slug}`}
      moduleLabel={`Module ${mod.label ?? mod.number}`}
      label={`${mod.label ?? mod.number}.${unit.meta.position}`}
      title={unit.check.title}
      guidanceLabel={GUIDANCE_LABEL[unit.meta.guidance]}
      introHtml={renderMarkdown(parts.intro)}
      task={parts.task.map((s) => ({ heading: s.heading, html: renderMarkdown(s.body) }))}
      steps={fold(parts.steps)}
      hints={fold(parts.hints)}
      debuggingHtml={renderMarkdown(unit.debuggingLab)}
      ownBuildHtml={renderMarkdown(unit.ownBuild)}
      command={<CopyCommand command={`npx academy check ${unit.check.id}`} quiet={passedNow} />}
      results={<Results runs={runs} />}
      review={<ReviewLink href={`/project/${unit.check.id}/review`} passed={passedNow} revisions={reviews.count ?? 0} />}
    />
  );
}
