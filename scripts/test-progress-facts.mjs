/** T11: the four progress facts (pure), including a pass of an old check version. */
import assert from "node:assert/strict";
import { projectFacts } from "../apps/web/src/lib/progress/facts.ts";

const P = { slug: "m1-p1", label: "1.1", title: "Find your way", currentVersion: "1.1.0" };
const now = new Date("2026-12-10T12:00:00Z");
const row = (extra = {}) => ({ item_slug: "m1-p1", state: "read", due_on: null, updated_at: "2026-12-01T10:00:00Z", ...extra });
let checks = 0;
const f = (progress = [], runs = [], reviews = []) => projectFacts(P, progress, runs, reviews, now);
const eq = (a, b, label) => { assert.deepEqual(a, b, label); checks++; };

// Nothing yet: every fact is "not yet", never false or zero.
eq([f().done, f().checker, f().review, f().onTime], ["none", null, null, null], "new learner: all not yet");

// Done.
eq(f([row()]).done, "active");
eq(f([row({ state: "done" })]).done, "done");

// Checker: only the CURRENT version counts.
eq(f([], [{ item_slug: "m1-p1", version: "1.0.0", passed: true }]).checker, null, "a pass of an old version does not count");
eq(f([], [{ item_slug: "m1-p1", version: "1.1.0", passed: false }]).checker, false, "runs of the current version, none passing");
eq(f([], [{ item_slug: "m1-p1", version: "1.1.0", passed: false }, { item_slug: "m1-p1", version: "1.1.0", passed: true }]).checker, true, "one passing run is enough");
eq(f([], [{ item_slug: "m2-p1", version: "1.1.0", passed: true }]).checker, null, "another project's run does not count");

// Review: the learner's own, present or not yet.
eq(f([], [], [{ item_slug: "m1-p1" }]).review, true);
eq(f([], [], [{ item_slug: "m2-p1" }]).review, null);

// On time.
eq(f([row({ due_on: "2026-12-20T00:00:00Z" })]).onTime, null, "not due yet: not yet");
eq(f([row({ due_on: "2026-12-05T00:00:00Z" })]).onTime, false, "due date passed, not done: late");
eq(f([row({ state: "done", due_on: "2026-12-05T00:00:00Z", updated_at: "2026-12-04T09:00:00Z" })]).onTime, true, "done before the due date");
eq(f([row({ state: "done", due_on: "2026-12-05T00:00:00Z", updated_at: "2026-12-06T09:00:00Z" })]).onTime, false, "done after the due date");

// The four facts stay separate: a late, unchecked project can still be done.
const mixed = f([row({ state: "done", due_on: "2026-12-05T00:00:00Z", updated_at: "2026-12-06T09:00:00Z" })]);
eq([mixed.done, mixed.checker, mixed.review, mixed.onTime], ["done", null, null, false], "facts are never merged");

console.log(`Progress facts: ${checks} checks passed.`);
