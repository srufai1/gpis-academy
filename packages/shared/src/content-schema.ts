/**
 * The course content format (T05): types and validators for content/course.yaml,
 * unit.md front matter, quiz.json and check/check.yaml. Pure: no file access here.
 * Every validator returns a list of problems; an empty list means the value is valid.
 */

export type Guidance = "guided" | "half" | "independent";
export const GUIDANCE: readonly Guidance[] = ["guided", "half", "independent"];

export type CourseModule = {
  number: number;
  slug: string;
  title: string;
  guidance: Guidance;
  guidance_label: string;
  weeks: number;
  label?: string;
};

export type UnitMeta = {
  id: string;
  title: string;
  module: number;
  position: number;
  guidance: Guidance;
  minutes: number;
  project: string;
  gpis_part: string;
  requires: string[];
};

export type QuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  answer: number;
  why: string;
  wrong: Record<string, string>;
};

export type Quiz = { id: string; title: string; pass_mark: number; questions: QuizQuestion[] };

/** What the browser may see before an attempt is marked: no answers, no reasons. */
export type PublicQuiz = {
  id: string;
  title: string;
  pass_mark: number;
  questions: { id: string; prompt: string; options: string[] }[];
};

export type CheckStep = { id: string; kind: string; title: string; required: boolean };
export type CheckDefinition = { id: string; title: string; version: string; unit: string; steps: CheckStep[] };

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+$/;
export const STEP_KINDS = ["files", "doc", "git", "tests", "static", "sql", "page"] as const;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isText = (v: unknown, max = 500): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= max;
const isInt = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const isSlug = (v: unknown): v is string => typeof v === "string" && SLUG.test(v) && v.length <= 80;

export function validateCourse(value: unknown): string[] {
  if (!isObj(value) || !Array.isArray(value.modules) || value.modules.length === 0) return ["modules must be a non-empty list"];
  const problems: string[] = [];
  const slugs = new Set<string>();
  value.modules.forEach((m: unknown, i: number) => {
    const at = `modules[${i}]`;
    if (!isObj(m)) { problems.push(`${at} must be an object`); return; }
    if (!isInt(m.number, 1, 99)) problems.push(`${at}.number must be a whole number`);
    if (!isSlug(m.slug)) problems.push(`${at}.slug must be lowercase letters, digits and hyphens`);
    else if (slugs.has(m.slug)) problems.push(`${at}.slug "${m.slug}" is used twice`);
    else slugs.add(m.slug);
    if (!isText(m.title, 200)) problems.push(`${at}.title is missing`);
    if (!GUIDANCE.includes(m.guidance as Guidance)) problems.push(`${at}.guidance must be guided, half or independent`);
    if (!isText(m.guidance_label, 60)) problems.push(`${at}.guidance_label is missing`);
    if (!isInt(m.weeks, 1, 52)) problems.push(`${at}.weeks must be 1 to 52`);
  });
  return problems;
}

export function validateUnitMeta(value: unknown): string[] {
  if (!isObj(value)) return ["front matter is missing"];
  const problems: string[] = [];
  if (!isSlug(value.id)) problems.push("id must be lowercase letters, digits and hyphens");
  if (!isText(value.title, 200)) problems.push("title is missing");
  if (!isInt(value.module, 1, 99)) problems.push("module must be a module number");
  if (!isInt(value.position, 1, 99)) problems.push("position must be 1 to 99");
  if (!GUIDANCE.includes(value.guidance as Guidance)) problems.push("guidance must be guided, half or independent");
  if (!isInt(value.minutes, 1, 6000)) problems.push("minutes must be a whole number");
  if (!isSlug(value.project)) problems.push("project must be the check id of the unit's lab");
  if (!isText(value.gpis_part, 300)) problems.push("gpis_part is missing");
  if (!Array.isArray(value.requires) || !value.requires.every((r) => isSlug(r))) problems.push("requires must be a list of names");
  return problems;
}

export function validateQuiz(value: unknown): string[] {
  if (!isObj(value)) return ["quiz must be an object"];
  const problems: string[] = [];
  if (!isSlug(value.id)) problems.push("id must be lowercase letters, digits and hyphens");
  if (!isText(value.title, 200)) problems.push("title is missing");
  const questions = Array.isArray(value.questions) ? value.questions : null;
  if (!questions || questions.length < 1 || questions.length > 30) return [...problems, "questions must be a list of 1 to 30"];
  if (!isInt(value.pass_mark, 1, questions.length)) problems.push(`pass_mark must be 1 to ${questions.length}`);
  const ids = new Set<string>();
  questions.forEach((q: unknown, i: number) => {
    const at = `questions[${i}]`;
    if (!isObj(q)) { problems.push(`${at} must be an object`); return; }
    if (!isSlug(q.id)) problems.push(`${at}.id must be lowercase letters, digits and hyphens`);
    else if (ids.has(q.id)) problems.push(`${at}.id "${q.id}" is used twice`);
    else ids.add(q.id);
    if (!isText(q.prompt, 1000)) problems.push(`${at}.prompt is missing`);
    const options = Array.isArray(q.options) ? q.options : [];
    if (options.length < 2 || options.length > 8 || !options.every((o) => isText(o, 500))) problems.push(`${at}.options must be 2 to 8 texts`);
    if (!isInt(q.answer, 0, Math.max(options.length - 1, 0))) problems.push(`${at}.answer is out of range (0 to ${options.length - 1})`);
    if (!isText(q.why, 1000)) problems.push(`${at}.why is missing`);
    if (!isObj(q.wrong)) problems.push(`${at}.wrong must give a reason for each wrong option`);
    else options.forEach((_o: unknown, k: number) => {
      if (k !== q.answer && !isText((q.wrong as Obj)[String(k)], 1000)) problems.push(`${at}.wrong has no reason for option ${k}`);
    });
  });
  return problems;
}

export function validateCheck(value: unknown): string[] {
  if (!isObj(value)) return ["check.yaml must be an object"];
  const problems: string[] = [];
  if (!isSlug(value.id)) problems.push("id must be lowercase letters, digits and hyphens");
  if (!isText(value.title, 200)) problems.push("title is missing");
  if (typeof value.version !== "string" || !VERSION.test(value.version)) problems.push("version must look like 1.0.0");
  if (!isSlug(value.unit)) problems.push("unit must be the unit id");
  const steps = Array.isArray(value.steps) ? value.steps : null;
  if (!steps || steps.length === 0) return [...problems, "steps must be a non-empty list"];
  const ids = new Set<string>();
  steps.forEach((s: unknown, i: number) => {
    const at = `steps[${i}]`;
    if (!isObj(s)) { problems.push(`${at} must be an object`); return; }
    if (!isSlug(s.id)) problems.push(`${at}.id must be lowercase letters, digits and hyphens`);
    else if (ids.has(s.id)) problems.push(`${at}.id "${s.id}" is used twice`);
    else ids.add(s.id);
    if (!(STEP_KINDS as readonly string[]).includes(s.kind as string)) problems.push(`${at}.kind must be one of ${STEP_KINDS.join(", ")}`);
    if (!isText(s.title, 200)) problems.push(`${at}.title is missing`);
    if (typeof s.required !== "boolean") problems.push(`${at}.required must be true or false`);
  });
  return problems;
}

export function toPublicQuiz(quiz: Quiz): PublicQuiz {
  return {
    id: quiz.id,
    title: quiz.title,
    pass_mark: quiz.pass_mark,
    questions: quiz.questions.map((q) => ({ id: q.id, prompt: q.prompt, options: [...q.options] })),
  };
}
