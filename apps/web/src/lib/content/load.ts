import "server-only";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { cache } from "react";
import { loadCourse, type Course, type Unit } from "@ruftech-academy/shared/content-load";
import { toPublicQuiz, type CourseModule, type PublicQuiz } from "@ruftech-academy/shared/content-schema";

/**
 * The course, read from content/ on the server (T05). Never import this into a
 * Client Component: units hold quiz answers. Pass only what a screen needs,
 * and quizzes only through publicQuiz().
 */
function findContentRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, "content");
    if (existsSync(join(candidate, "course.yaml"))) return candidate;
    dir = dirname(dir);
  }
  throw new Error("content/course.yaml was not found");
}

let cached: Course | null = null;
export const getCourse = cache((): Course => {
  if (cached && process.env.NODE_ENV === "production") return cached;
  cached = loadCourse(findContentRoot());
  return cached;
});

export function getUnit(id: string): Unit | null {
  return getCourse().units.find((u) => u.meta.id === id) ?? null;
}

export function getUnitByProject(projectId: string): Unit | null {
  return getCourse().units.find((u) => u.check.id === projectId) ?? null;
}

export function getModule(slug: string): CourseModule | null {
  return getCourse().modules.find((m) => m.slug === slug) ?? null;
}

export function moduleOfUnit(unit: Unit): CourseModule {
  return getCourse().modules.find((m) => m.number === unit.meta.module)!;
}

export function publicQuiz(unit: Unit): PublicQuiz {
  return toPublicQuiz(unit.quiz);
}
