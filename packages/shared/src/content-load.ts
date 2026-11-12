/**
 * Reads content/ into typed data (T05). Node only (file access).
 * A problem anywhere stops the load with "file: reason" lines, so a broken
 * unit can never be published or shown.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  validateCheck, validateCourse, validateQuiz, validateUnitMeta,
  type CheckDefinition, type CourseModule, type Quiz, type UnitMeta,
} from "./content-schema.ts";

export const UNIT_FILES = ["unit.md", "lesson.md", "example.md", "quiz.json", "lab.md", "debugging-lab.md", "own-build.md", "review.md"] as const;

export type Unit = {
  meta: UnitMeta;
  dir: string;
  body: string; // unit.md without its front matter
  lesson: string;
  example: string;
  lab: string;
  debuggingLab: string;
  ownBuild: string;
  review: string;
  quiz: Quiz;
  check: CheckDefinition;
  hashes: { unit: string; quiz: string; project: string; check: string };
};

export type Course = { modules: CourseModule[]; units: Unit[] };

export class ContentError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`Content is not valid:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    this.name = "ContentError";
    this.problems = problems;
  }
}

export const sha256 = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");

function listFiles(dir: string): string[] {
  return readdirSync(dir).sort().flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

/** Stable hash of a folder: every file's relative path and content hash, in sorted order. */
export function folderHash(dir: string): string {
  const lines = listFiles(dir).map((file) => `${relative(dir, file).split("\\").join("/")}\0${sha256(readFileSync(file))}`);
  return sha256(lines.join("\n"));
}

function splitFrontMatter(text: string): { data: unknown; body: string } | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  return match ? { data: parseYaml(match[1] ?? ""), body: match[2] ?? "" } : null;
}

function readUnit(contentRoot: string, dir: string, problems: string[]): Unit | null {
  const rel = (name: string) => relative(contentRoot, join(dir, name)).split("\\").join("/");
  const missing = UNIT_FILES.filter((name) => !existsSync(join(dir, name)));
  if (!existsSync(join(dir, "check", "check.yaml"))) missing.push("check/check.yaml" as never);
  if (missing.length) { missing.forEach((m) => problems.push(`${rel(m)}: file is missing`)); return null; }

  const text = (name: string) => readFileSync(join(dir, name), "utf8");
  const before = problems.length;
  const fm = splitFrontMatter(text("unit.md"));
  if (!fm) problems.push(`${rel("unit.md")}: front matter (--- … ---) is missing`);
  else validateUnitMeta(fm.data).forEach((p) => problems.push(`${rel("unit.md")}: ${p}`));

  let quiz: unknown;
  try { quiz = JSON.parse(text("quiz.json")); } catch { problems.push(`${rel("quiz.json")}: not valid JSON`); }
  if (quiz !== undefined) validateQuiz(quiz).forEach((p) => problems.push(`${rel("quiz.json")}: ${p}`));

  let check: unknown;
  try { check = parseYaml(text("check/check.yaml")); } catch { problems.push(`${rel("check/check.yaml")}: not valid YAML`); }
  if (check !== undefined) validateCheck(check).forEach((p) => problems.push(`${rel("check/check.yaml")}: ${p}`));
  if (problems.length > before || !fm) return null;

  const meta = fm.data as UnitMeta;
  const def = check as CheckDefinition;
  if (def.unit !== meta.id) problems.push(`${rel("check/check.yaml")}: unit is "${def.unit}" but unit.md has id "${meta.id}"`);
  if (def.id !== meta.project) problems.push(`${rel("unit.md")}: project is "${meta.project}" but check.yaml has id "${def.id}"`);

  const files = ["lesson.md", "example.md", "lab.md", "debugging-lab.md", "own-build.md", "review.md"].map(text);
  return {
    meta, dir, body: fm.body,
    lesson: files[0]!, example: files[1]!, lab: files[2]!, debuggingLab: files[3]!, ownBuild: files[4]!, review: files[5]!,
    quiz: quiz as Quiz, check: def,
    hashes: {
      unit: sha256(["unit.md", "lesson.md", "example.md"].map(text).join("\0")),
      quiz: sha256(text("quiz.json")),
      project: sha256([...["lab.md", "debugging-lab.md", "own-build.md", "review.md"].map(text), folderHash(join(dir, "check"))].join("\0")),
      check: folderHash(join(dir, "check")),
    },
  };
}

/** Load content/: course.yaml and every module-NN/unit-NN folder. Throws ContentError on any problem. */
export function loadCourse(contentRoot: string): Course {
  const problems: string[] = [];
  let modules: CourseModule[] = [];
  const coursePath = join(contentRoot, "course.yaml");
  if (!existsSync(coursePath)) problems.push("course.yaml: file is missing");
  else {
    let course: unknown;
    try { course = parseYaml(readFileSync(coursePath, "utf8")); } catch { problems.push("course.yaml: not valid YAML"); }
    const found = validateCourse(course);
    found.forEach((p) => problems.push(`course.yaml: ${p}`));
    if (course !== undefined && found.length === 0) modules = (course as { modules: CourseModule[] }).modules;
  }

  const unitDirs = readdirSync(contentRoot).filter((m) => /^module-\d{2}$/.test(m)).sort()
    .flatMap((m) => readdirSync(join(contentRoot, m)).filter((u) => /^unit-\d{2}$/.test(u)).sort().map((u) => join(contentRoot, m, u)));
  const units = unitDirs.map((dir) => readUnit(contentRoot, dir, problems)).filter((u): u is Unit => u !== null);

  // Ids are shared by units, quizzes and projects (they become content_items slugs).
  const seen = new Map<string, string>(modules.map((m) => [m.slug, "course.yaml"]));
  for (const unit of units) {
    const where = relative(contentRoot, unit.dir).split("\\").join("/");
    for (const id of [unit.meta.id, unit.quiz.id, unit.check.id]) {
      const first = seen.get(id);
      if (first) problems.push(`${where}: id "${id}" is already used in ${first}`);
      else seen.set(id, where);
    }
    if (!modules.some((m) => m.number === unit.meta.module)) problems.push(`${where}/unit.md: module ${unit.meta.module} is not in course.yaml`);
  }
  if (problems.length) throw new ContentError(problems);
  units.sort((a, b) => a.meta.module - b.meta.module || a.meta.position - b.meta.position);
  return { modules, units };
}
