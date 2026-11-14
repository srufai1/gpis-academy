import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageError } from "@/components/page-error";
import { ReviewView } from "@/components/views/review-view";
import { requireLearner } from "@/lib/auth/learner";
import { formatWhen } from "@/lib/check-runs/read";
import { getUnitByProject, moduleOfUnit } from "@/lib/content/load";
import { renderMarkdown } from "@/lib/content/markdown";
import { reviewContent } from "@/lib/reviews/content";
import { hasCurrentPass, readRevisions } from "@/lib/reviews/read";
import { saveReview } from "./actions";
import { ReviewForm } from "./review-form";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const unit = getUnitByProject((await params).id);
  return { title: unit ? `Self-review · ${unit.check.title}` : "Self-review" };
}

export default async function ReviewPage({ params }: Props) {
  const { claims, supabase } = await requireLearner();
  const unit = getUnitByProject((await params).id);
  if (!unit) notFound();
  const projectId = unit.check.id;
  const content = reviewContent(unit.review);
  let open: boolean;
  let revisions;
  try {
    [open, revisions] = await Promise.all([hasCurrentPass(supabase, projectId, unit.check.version), readRevisions(supabase, projectId)]);
  } catch {
    return <PageError />;
  }
  const profile = await supabase.from("profiles").select("time_zone").eq("id", claims.sub).maybeSingle();
  const timeZone = (profile.data?.time_zone as string | undefined) ?? "Africa/Accra";
  const latest = revisions[0];
  const mod = moduleOfUnit(unit);
  return (
    <ReviewView
      projectHref={`/project/${projectId}`}
      label={`${mod.label ?? mod.number}.${unit.meta.position}`}
      title={unit.check.title}
      open={open}
      version={unit.check.version}
      command={`npx academy check ${projectId}`}
      introHtml={renderMarkdown(content.intro)}
      masteryHtml={content.mastery ? renderMarkdown(content.mastery) : ""}
      reflectionHtml={content.reflection ? renderMarkdown(content.reflection) : ""}
      revisions={revisions.map((r) => ({ revision: r.revision, when: formatWhen(r.createdAt, timeZone), checklist: r.checklist, explanation: r.explanation, comparison: r.comparison }))}
      form={
        <ReviewForm
          action={saveReview.bind(null, projectId)}
          items={content.checklist}
          compareHtml={renderMarkdown(content.compare)}
          defaults={{
            checked: content.checklist.map((text) => latest?.checklist.find((i) => i.text === text)?.checked ?? false),
            explanation: latest?.explanation ?? "",
            comparison: latest?.comparison ?? "",
          }}
        />
      }
    />
  );
}
