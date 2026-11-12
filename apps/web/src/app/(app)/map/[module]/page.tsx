import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageError } from "@/components/page-error";
import { ModuleView } from "@/components/views/module-view";
import { requireLearner } from "@/lib/auth/learner";
import { courseOutline } from "@/lib/content/outline";
import { readProgress } from "@/lib/progress/read";

type Props = { params: Promise<{ module: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { module: slug } = await params;
  const found = courseOutline().find((m) => m.slug === slug);
  return { title: found ? found.title : "Module" };
}

export default async function ModulePage({ params }: Props) {
  const { supabase } = await requireLearner();
  const { module: slug } = await params;
  const found = courseOutline().find((m) => m.slug === slug);
  if (!found) notFound();
  const progress = await readProgress(supabase);
  if (!progress) return <PageError />;
  return <ModuleView module={found} progress={progress} />;
}
