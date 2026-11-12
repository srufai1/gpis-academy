/** T07: the course map rules (pure). */
import assert from "node:assert/strict";
import { hasStarted, itemLine, moduleRows, nextItem } from "../apps/web/src/lib/progress/summary.ts";
import { OUTLINE } from "./lib/sample-outline.mjs";

let checks = 0;
const eq = (a, b, label) => { assert.deepEqual(a, b, label); checks++; };

// A new learner: nothing started; next is the first lesson.
eq(hasStarted({}), false, "new learner has not started");
eq(nextItem(OUTLINE, {})?.href, "/learn/m1-u1", "new learner starts with the first lesson");

// Order inside a unit: lesson → quiz → project.
eq(nextItem(OUTLINE, { "m1-u1": "read" })?.kind, "quiz", "after reading, the quiz is next");
eq(nextItem(OUTLINE, { "m1-u1": "read", "m1-u1-quiz": "quiz_passed" })?.href, "/project/m1-p1", "after the quiz, the project");
eq(nextItem(OUTLINE, { "m1-u1": "read", "m1-u1-quiz": "quiz_passed", "m1-p1": "done" })?.href, "/learn/m1-u2", "then the next unit");

// "started" is not finished; a skipped item is still next (nothing is locked, but the gap is shown).
eq(nextItem(OUTLINE, { "m1-u1": "started" })?.slug, "m1-u1", "a started lesson is still next");
eq(itemLine(nextItem(OUTLINE, { "m1-u1": "started" }), { "m1-u1": "started" }), "Lesson · in progress");
eq(nextItem(OUTLINE, { "m1-u2": "read" })?.slug, "m1-u1", "work done later does not hide an earlier gap");

// Everything finished: no next item.
const all = Object.fromEntries(OUTLINE.flatMap((m) => m.units.flatMap((u) => [[u.id, "read"], [u.quizId, "quiz_passed"], [u.projectId, "done"]])));
eq(nextItem(OUTLINE, all), null, "all finished: nothing next");

// Module rows: counts and status.
const rows = moduleRows(OUTLINE, { "m1-u1": "read", "m1-u1-quiz": "quiz_passed", "m1-p1": "done" });
eq(rows.map((r) => [r.slug, r.projectsDone, r.projectsTotal, r.status]), [["m1", 1, 2, "active"], ["m2", 0, 1, "not-started"], ["m3", 0, 0, "not-started"]]);
eq(moduleRows(OUTLINE, all).slice(0, 2).map((r) => r.status), ["done", "done"], "finished modules are done");
eq(moduleRows(OUTLINE, all)[2].status, "not-started", "a module with no units yet is never done");

console.log(`Progress summary: ${checks} checks passed.`);
