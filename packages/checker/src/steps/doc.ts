/**
 * Step kind "doc" (T14): a Markdown file has the asked headings, each with enough words.
 *   expect: { path, headings: ["## A", …], min_words_per_heading, min_words }
 */
import { readFileSync } from "node:fs";
import { CheckerError } from "../errors.ts";
import { insideRoot } from "../safe-path.ts";
import type { StepKindImpl } from "../runner.ts";

const words = (text: string) => (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;

export const docStep: StepKindImpl = (step, ctx) => {
  const e = step.expect as { path?: string; headings?: string[]; min_words_per_heading?: number; min_words?: number } | undefined;
  if (!e || typeof e.path !== "string") throw new CheckerError("a doc step needs expect.path");
  let text: string;
  try { text = readFileSync(insideRoot(ctx.workDir, e.path, { followLinks: true }), "utf8"); } catch (error) {
    if (error instanceof CheckerError) throw error;
    return { outcome: "fail", reasons: [`${e.path} is missing`] };
  }
  const lines = text.split(/\r?\n/);
  const reasons: string[] = [];
  for (const heading of e.headings ?? []) {
    const at = lines.findIndex((l) => l.trim() === heading.trim());
    if (at < 0) { reasons.push(`missing heading: ${heading}`); continue; }
    const next = lines.findIndex((l, i) => i > at && /^#{1,6} /.test(l));
    const count = words(lines.slice(at + 1, next < 0 ? undefined : next).join(" "));
    if (e.min_words_per_heading && count < e.min_words_per_heading) reasons.push(`"${heading}" has ${count} words; at least ${e.min_words_per_heading} are needed`);
  }
  if (e.min_words && words(text) < e.min_words) reasons.push(`${e.path} has ${words(text)} words; at least ${e.min_words} are needed`);
  return { outcome: reasons.length ? "fail" : "pass", reasons };
};
