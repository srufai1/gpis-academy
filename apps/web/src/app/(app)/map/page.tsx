import type { Metadata } from "next";
import { PageError } from "@/components/page-error";
import { MapView } from "@/components/views/map-view";
import { requireLearner } from "@/lib/auth/learner";
import { courseOutline } from "@/lib/content/outline";
import { readProgress } from "@/lib/progress/read";
import { hasStarted, itemLine, moduleRows, nextItem } from "@/lib/progress/summary";

export const metadata: Metadata = { title: "Course map" };

export default async function MapPage() {
  const { supabase } = await requireLearner();
  const progress = await readProgress(supabase);
  if (!progress) return <PageError />;
  const outline = courseOutline();
  const next = nextItem(outline, progress);
  return <MapView next={next} nextLine={next ? itemLine(next, progress) : ""} modules={moduleRows(outline, progress)} isNew={!hasStarted(progress)} />;
}
