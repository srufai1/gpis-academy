/**
 * Course map rules (T07). Pure: no database, no React.
 * Course order inside a unit: lesson → quiz → project. Nothing is ever locked;
 * "next" is only a suggestion: the first item not yet finished.
 */
export type ProgressState = "started" | "read" | "quiz_passed" | "done";
export type ProgressMap = Readonly<Record<string, ProgressState | undefined>>;

export type OutlineUnit = { id: string; label: string; title: string; quizId: string; projectId: string; projectTitle: string };
export type OutlineModule = { slug: string; number: number; label: string; title: string; guidanceLabel: string; weeks: number; units: OutlineUnit[] };

export type ItemKind = "lesson" | "quiz" | "project";
export type CourseItem = { kind: ItemKind; slug: string; label: string; title: string; href: string; moduleSlug: string };

export type ModuleRow = OutlineModule & {
  projectsTotal: number;
  projectsDone: number;
  status: "done" | "active" | "not-started";
};

/** The three items of a unit, in course order. */
export function unitItems(moduleSlug: string, unit: OutlineUnit): CourseItem[] {
  return [
    { kind: "lesson", slug: unit.id, label: unit.label, title: unit.title, href: `/learn/${unit.id}`, moduleSlug },
    { kind: "quiz", slug: unit.quizId, label: unit.label, title: unit.title, href: `/learn/${unit.id}#quiz`, moduleSlug },
    { kind: "project", slug: unit.projectId, label: unit.label, title: unit.projectTitle, href: `/project/${unit.projectId}`, moduleSlug },
  ];
}

export function courseItems(outline: OutlineModule[]): CourseItem[] {
  return outline.flatMap((m) => m.units.flatMap((u) => unitItems(m.slug, u)));
}

/** Finished means: lesson read (or more), quiz passed, project done. */
export function isFinished(item: Pick<CourseItem, "kind" | "slug">, progress: ProgressMap): boolean {
  const state = progress[item.slug];
  if (item.kind === "lesson") return state === "read" || state === "quiz_passed" || state === "done";
  if (item.kind === "quiz") return state === "quiz_passed" || state === "done";
  return state === "done";
}

export function hasStarted(progress: ProgressMap): boolean {
  return Object.values(progress).some((s) => s !== undefined);
}

/** The first unfinished item in course order, or null when everything is finished. */
export function nextItem(outline: OutlineModule[], progress: ProgressMap): CourseItem | null {
  return courseItems(outline).find((item) => !isFinished(item, progress)) ?? null;
}

export function moduleRows(outline: OutlineModule[], progress: ProgressMap): ModuleRow[] {
  return outline.map((m) => {
    const items = m.units.flatMap((u) => unitItems(m.slug, u));
    const projectsDone = m.units.filter((u) => progress[u.projectId] === "done").length;
    const allDone = items.length > 0 && items.every((i) => isFinished(i, progress));
    const anyTouched = items.some((i) => progress[i.slug] !== undefined);
    return { ...m, projectsTotal: m.units.length, projectsDone, status: allDone ? "done" : anyTouched ? "active" : "not-started" };
  });
}

/** One short line for the Continue row. */
export function itemLine(item: CourseItem, progress: ProgressMap): string {
  if (item.kind === "lesson") return progress[item.slug] === "started" ? "Lesson · in progress" : "Lesson";
  if (item.kind === "quiz") return "Quiz · not passed yet";
  return "Project · not done yet";
}
