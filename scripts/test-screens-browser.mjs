/**
 * T23: the quality gates on the five screens of the mockups, each in several states, at 360px,
 * in light and in dark mode: no sideways scroll, targets at least 44px, one main button where
 * the mockup has one, the keyboard reaches every control, text contrast AA. Plus the shared
 * loading and error states. Every problem is listed; the test fails if there is any.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderView } from "./lib/render-view.mjs";
import { withPhone } from "./lib/browser.mjs";
import { audit, mainButtons } from "./lib/quality.mjs";
import { OUTLINE } from "./lib/sample-outline.mjs";
import { itemLine, moduleRows, nextItem } from "../apps/web/src/lib/progress/summary.ts";
import { projectFacts } from "../apps/web/src/lib/progress/facts.ts";
import { renderMarkdown } from "../apps/web/src/lib/content/markdown.ts";
import { countItems, projectParts } from "../apps/web/src/lib/content/sections.ts";
import { formatWhen, toRunViews } from "../apps/web/src/lib/check-runs/read.ts";

const read = (f) => readFileSync(new URL(`../content/module-01/unit-01/${f}`, import.meta.url), "utf8");
const inner = (html) => html.slice(html.indexOf("<main"), html.lastIndexOf("</main>")).replace(/^<main[^>]*>/, "");
/** Put a rendered part into a rendered page, after the element that matches `after`. */
const insertAfter = (html, after, part) => {
  const i = html.indexOf(after);
  assert.ok(i >= 0, `marker not found: ${after}`);
  return html.slice(0, i + after.length) + part + html.slice(i + after.length);
};

/* ------------------------------------------------------------------ the screens and their states */
const map = (progress, isNew) => {
  const next = nextItem(OUTLINE, progress);
  return renderView("components/views/map-view.tsx", "MapView", { next, nextLine: next ? itemLine(next, progress) : "", modules: moduleRows(OUTLINE, progress), isNew });
};
const lesson = (isRead) => renderView("components/views/lesson-view.tsx", "LessonView", {
  moduleHref: "/map/m1", moduleLabel: "Module 1", label: "1.1", title: "The terminal and the filesystem",
  lessonHtml: renderMarkdown(read("lesson.md")), exampleHtml: renderMarkdown(read("example.md")),
  gpisPart: "The folder layout of the GPIS repository", read: isRead,
});
const steps = [
  { id: "list", kind: "files", title: "The class list is in reports/term-1", required: true, outcome: "pass", reasons: [] },
  { id: "link", kind: "files", title: "current points to reports/term-2", required: true, outcome: "fail", reasons: ["current points to reports/term2, not reports/term-2"] },
];
const run = (id, passed) => ({ id, passed, commit_sha: "a1b2c3d4", tree_clean: true, checker_version: "0.1.0", created_at: "2026-11-13T20:59:00Z",
  results: { steps: passed ? steps.map((s) => ({ ...s, outcome: "pass", reasons: [] })) : steps }, check_definitions: { item_slug: "m1-p1", version: "1.0.0" } });
async function project(runs, revisions) {
  const p = projectParts(read("lab.md"), "guided");
  const fold = (s) => (s ? { count: countItems(s.body), html: renderMarkdown(s.body) } : null);
  let html = await renderView("components/views/project-view.tsx", "ProjectView", {
    moduleHref: "/map/m1", moduleLabel: "Module 1", label: "1.1", title: "Find your way", guidanceLabel: "Guided",
    introHtml: renderMarkdown(p.intro), task: p.task.map((s) => ({ heading: s.heading, html: renderMarkdown(s.body) })),
    steps: fold(p.steps), hints: fold(p.hints), debuggingHtml: renderMarkdown(read("debugging-lab.md")), ownBuildHtml: renderMarkdown(read("own-build.md")),
  });
  const shown = toRunViews(runs, new Map([["m1-p1", "1.0.0"]])).map((r) => ({ ...r, when: formatWhen(r.recordedAt, "Africa/Accra") }));
  const passed = shown.some((r) => r.passed && r.currentVersion);
  const command = inner(await renderView("components/copy-command.tsx", "CopyCommand", { command: "npx academy check m1-p1", quiet: passed }));
  const results = inner(await renderView("app/(app)/project/[id]/results.tsx", "Results", { runs: shown }));
  const review = inner(await renderView("app/(app)/project/[id]/review-link.tsx", "ReviewLink", { href: "/project/m1-p1/review", passed, revisions }));
  html = insertAfter(html, 'Run in your terminal</h2>', command);
  html = insertAfter(html, 'Last result</h2>', results);
  return insertAfter(html, 'After a pass</h2>', review);
}
const now = new Date("2026-12-10T12:00:00Z");
const ref = (slug, label, title) => ({ slug, label, title, currentVersion: "1.0.0" });
const progress = (rows, runs, reviews, done) => renderView("components/views/progress-view.tsx", "ProgressView", {
  modules: [{ slug: "m1", title: "Command line, Git and how the web works", label: "1", projects: [
    projectFacts(ref("m1-p1", "1.1", "Find your way"), rows, runs, reviews, now),
    projectFacts(ref("m1-p2", "1.2", "Failure report"), [], [], [], now),
  ] }],
  projectsDone: done, quizzesPassed: done, next: { href: "/learn/m1-u2", label: "1.2 Streams and pipes" },
});

import { reviewContent } from "../apps/web/src/lib/reviews/content.ts";
const content = reviewContent(read("review.md"));
async function review(open) {
  let html = await renderView("components/views/review-view.tsx", "ReviewView", {
    projectHref: "/project/m1-p1", label: "1.1", title: "Find your way", open, version: "1.0.0", command: "npx academy check m1-p1",
    introHtml: renderMarkdown(content.intro), masteryHtml: renderMarkdown(content.mastery), reflectionHtml: renderMarkdown(content.reflection),
    revisions: open ? [{ revision: 1, when: "14 Nov, 10:05", checklist: content.checklist.map((text) => ({ text, checked: true })), explanation: "Mine.", comparison: "Same." }] : [],
  });
  if (open) {
    const form = inner(await renderView("../../../scripts/lib/review-form-fixture.tsx", "ReviewFormFixture", {
      items: content.checklist, compareHtml: renderMarkdown(content.compare), defaults: { checked: [], explanation: "", comparison: "" } }));
    html = html.replace('<div data-slot="review-form"></div>', () => `<div data-slot="review-form">${form}</div>`);
  }
  return html;
}

const SCREENS = [
  // [label, render, main buttons in the mockup]
  ["01 landing", () => renderView("app/(public)/page.tsx", "default", {}), 1],
  ["02 map · new learner", () => map({}, true), 1],
  ["02 map · in progress", () => map({ "m1-u1": "done", "m1-p1": "active" }, false), 0],
  ["02 map · all started", () => map({ "m1-u1": "done", "m1-u2": "read", "m2-u1": "read" }, false), 0],
  ["03 lesson · not read", () => lesson(false), 0],
  ["03 lesson · read", () => lesson(true), 0],
  // Mockup 04: Copy is the main action; after a pass of the current version, the self-review is.
  ["04 project · no result", () => project([], 0), 1],
  ["04 project · failed", () => project([run(2, false), run(1, false)], 0), 1],
  ["04 project · passed", () => project([run(3, true), run(2, false)], 1), 1],
  ["05 progress · new learner", () => progress([], [], [], 0), 1],
  ["05 progress · in progress", () => progress([{ item_slug: "m1-p1", state: "active", due_on: "2026-12-20", updated_at: "2026-12-01T00:00:00Z" }], [{ item_slug: "m1-p1", version: "1.0.0", passed: false }], [], 0), 1],
  ["05 progress · reviewed", () => progress([{ item_slug: "m1-p1", state: "done", due_on: "2026-12-01", updated_at: "2026-11-30T00:00:00Z" }], [{ item_slug: "m1-p1", version: "1.0.0", passed: true }], [{ item_slug: "m1-p1" }], 1), 1],
  ["review · before a pass (T22)", () => review(false), 0],
  ["review · open (T22)", () => review(true), 1],
  ["forgot password", () => renderView("../../../scripts/lib/password-forms-fixture.tsx", "ForgotFixture", {}), 1],
  ["choose a new password", () => renderView("../../../scripts/lib/password-forms-fixture.tsx", "ResetFixture", {}), 1],
  ["loading (every signed-in page)", () => renderView("app/(app)/loading.tsx", "default", {}), 0],
  ["error (every data page)", () => renderView("components/page-error.tsx", "PageError", {}), 0],
];

/* ------------------------------------------------------------------ run */
const problems = [];
let audited = 0;
await withPhone(async (page) => {
  for (const scheme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const [label, render, main] of SCREENS) {
      await page.setContent(await render());
      problems.push(...(await audit(page, `${label} (${scheme})`, { main })));
      audited++;
    }
  }
  // The loading state says it is loading, and the error state is announced.
  await page.setContent(await renderView("app/(app)/loading.tsx", "default", {}));
  assert.equal(await page.locator("[aria-busy='true'][aria-label='Loading']").count(), 1, "the loading state is announced as loading");
  await page.setContent(await renderView("components/page-error.tsx", "PageError", {}));
  assert.equal(await page.getByRole("alert").count(), 1, "the error state is announced");
  // After a pass the main button is the self-review, not Copy.
  await page.setContent(await project([run(3, true)], 0));
  assert.deepEqual(await mainButtons(page), ["Write self-review"], "after a pass: Write self-review is the one main button");
  await page.setContent(await project([run(2, false)], 0));
  assert.deepEqual(await mainButtons(page), ["Copy"], "before a pass: Copy is the one main button");
});

if (problems.length) console.error(problems.map((p) => `  - ${p}`).join("\n"));
assert.deepEqual(problems, [], `${problems.length} quality problems`);
console.log(`Screens: ${audited} screen states (light and dark) pass every quality gate.`);
