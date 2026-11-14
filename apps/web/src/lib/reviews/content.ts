/**
 * The parts of a unit's review.md that the self-review page uses (T22). Pure.
 *   "## Review checklist"  → the "- [ ] …" items the learner ticks
 *   "## Compare with GPIS" → the questions for the GPIS comparison
 *   "## Mastery check", "## Reflection…" → shown to read, not saved
 */
import { splitSections } from "../content/sections.ts";

export const MAX_CHECKLIST_ITEMS = 30;
export const MAX_ITEM_CHARS = 300;

export type ReviewContent = { checklist: string[]; intro: string; compare: string; mastery: string; reflection: string };

export function reviewContent(markdown: string): ReviewContent {
  const { intro, sections } = splitSections(markdown);
  const body = (pattern: RegExp) => sections.find((s) => pattern.test(s.heading))?.body ?? "";
  const checklist = body(/^review checklist/i).split(/\r?\n/)
    .map((line) => /^[-*] \[[ xX]\] (.+)$/.exec(line.trim())?.[1]?.trim())
    .filter((text): text is string => !!text)
    .map((text) => text.slice(0, MAX_ITEM_CHARS))
    .slice(0, MAX_CHECKLIST_ITEMS);
  return {
    checklist,
    intro: intro.replace(/^# .*$/m, "").trim(),
    compare: body(/^compare with gpis/i),
    mastery: body(/^mastery check/i),
    reflection: body(/^reflection/i),
  };
}
