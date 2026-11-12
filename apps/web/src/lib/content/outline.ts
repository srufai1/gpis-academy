import "server-only";
import type { OutlineModule } from "@/lib/progress/summary";
import { getCourse } from "./load";

/** The course map's structure, with no lesson text and no quiz answers. */
export function courseOutline(): OutlineModule[] {
  const { modules, units } = getCourse();
  return modules.map((m) => ({
    slug: m.slug,
    number: m.number,
    label: m.label ?? String(m.number),
    title: m.title,
    guidanceLabel: m.guidance_label,
    weeks: m.weeks,
    units: units.filter((u) => u.meta.module === m.number).map((u) => ({
      id: u.meta.id,
      label: `${m.label ?? m.number}.${u.meta.position}`,
      title: u.meta.title,
      quizId: u.quiz.id,
      projectId: u.check.id,
      projectTitle: u.check.title,
    })),
  }));
}
