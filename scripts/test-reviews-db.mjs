/**
 * T22: self-reviews in PGlite — insert only, own rows only, a new revision per save, text limits
 * in the database — plus the form rules and the reading of a unit's review.md.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { as, createUser, expectRefused, freshDatabase, rows, runner } from "./lib/pglite-schema.mjs";
import { readReviewForm, REVIEW_TEXT_MAX } from "../apps/web/src/lib/reviews/validate.ts";
import { reviewContent } from "../apps/web/src/lib/reviews/content.ts";
import { checklistOf } from "../apps/web/src/lib/reviews/read.ts";

const { test, done } = runner("Self-review");
const db = await freshDatabase();
await db.exec(`insert into public.content_items (slug, kind, parent_slug, position, title, guidance, content_hash) values
  ('m1', 'module', null, 1, 'Command line', 'guided', '${"ab".repeat(32)}'),
  ('m1-p1', 'project', 'm1', 1, 'Find your way', 'guided', '${"ab".repeat(32)}');`);
const a = await createUser(db, { email: "a@example.test" });
const b = await createUser(db, { email: "b@example.test" });
const checklist = { items: [{ text: "I typed the commands myself.", checked: true }] };
const save = (who, over = {}) => as(db, who, () => rows(db,
  "insert into public.reviews (user_id, item_slug, checklist, explanation, gpis_comparison) values ($1, $2, $3, $4, $5) returning revision",
  [over.user ?? who, over.slug ?? "m1-p1", over.checklist ?? checklist, over.explanation ?? "I moved the files with mv.", over.comparison ?? "GPIS keeps reports per term too."]));

await test("each save is a new revision; earlier ones stay readable", async () => {
  assert.deepEqual(await save(a.id), [{ revision: 1 }]);
  assert.deepEqual(await save(a.id, { explanation: "Second, better explanation." }), [{ revision: 2 }]);
  const mine = await as(db, a.id, () => rows(db, "select revision, explanation from public.reviews order by revision"));
  assert.deepEqual(mine.map((r) => r.revision), [1, 2]);
  assert.equal(mine[0].explanation, "I moved the files with mv.", "revision 1 is unchanged");
});

await test("a revision number cannot be chosen, and nothing can be changed or deleted", async () => {
  await as(db, a.id, () => expectRefused(db, "insert into public.reviews (user_id, item_slug, revision, checklist, explanation, gpis_comparison) values ($1, 'm1-p1', 99, '{}', 'x', 'y')", [a.id], /permission denied/));
  await as(db, a.id, () => expectRefused(db, "update public.reviews set explanation = 'rewritten'", [], /permission denied/));
  await as(db, a.id, () => expectRefused(db, "delete from public.reviews", [], /permission denied/));
});

await test("own rows only: no saving for someone else, no reading someone else's", async () => {
  await as(db, b.id, () => expectRefused(db,
    "insert into public.reviews (user_id, item_slug, checklist, explanation, gpis_comparison) values ($1, 'm1-p1', '{}', 'x', 'y')", [a.id], /row-level security/));
  assert.deepEqual(await as(db, b.id, () => rows(db, "select 1 from public.reviews")), [], "B sees none of A's reviews");
  assert.deepEqual(await save(b.id), [{ revision: 1 }], "B's own first review is B's revision 1");
  await as(db, "anon", () => expectRefused(db, "select * from public.reviews", [], /permission denied/));
});

await test("the database refuses empty or too long text, and an oversized checklist", async () => {
  await expectRefusedSave({ explanation: "" });
  await expectRefusedSave({ comparison: "" });
  await expectRefusedSave({ explanation: "x".repeat(4001) });
  await expectRefusedSave({ comparison: "x".repeat(4001) });
  await expectRefusedSave({ checklist: { items: Array.from({ length: 400 }, (_, i) => ({ text: `${i} ${"long text ".repeat(10)}`, checked: true })) } });
  await expectRefusedSave({ checklist: [] }, /check constraint/);
  assert.deepEqual(await save(a.id, { explanation: "x".repeat(4000) }), [{ revision: 3 }], "exactly 4000 characters is allowed");
});
async function expectRefusedSave(over, pattern = /check constraint/) {
  let message = null;
  try { await save(a.id, over); } catch (error) { message = error.message; }
  assert.ok(message && pattern.test(message), `expected a refusal for ${JSON.stringify(Object.keys(over))}: ${message}`);
}

await test("the form rules match the database (server side)", () => {
  const form = (values) => ({ get: (name) => values[name] ?? null });
  const items = ["one", "two"];
  assert.equal(REVIEW_TEXT_MAX, 4000);
  assert.deepEqual(readReviewForm(form({ explanation: "  ", gpis_comparison: "y" }), items), { ok: false, error: "Write your explanation first." });
  assert.deepEqual(readReviewForm(form({ explanation: "x", gpis_comparison: "" }), items), { ok: false, error: "Write your comparison with GPIS first." });
  assert.equal(readReviewForm(form({ explanation: "x".repeat(4001), gpis_comparison: "y" }), items).ok, false);
  const fine = readReviewForm(form({ explanation: " Mine. ", gpis_comparison: "Same.", "item-1": "on", "item-7": "on", "user_id": "someone-else" }), items);
  assert.deepEqual(fine, { ok: true, value: { checklist: { items: [{ text: "one", checked: false }, { text: "two", checked: true }] }, explanation: "Mine.", gpis_comparison: "Same." } },
    "trimmed; only the unit's own items; unknown fields such as user_id are ignored");
});

await test("the unit's review.md gives the checklist and the GPIS questions", () => {
  const content = reviewContent(readFileSync(new URL("../content/module-01/unit-01/review.md", import.meta.url), "utf8"));
  assert.equal(content.checklist.length, 6);
  assert.ok(content.checklist[1].startsWith("I typed the commands myself."));
  assert.ok(content.compare.includes("gpis-rebuild"), "the comparison questions");
  assert.ok(content.mastery.includes("You have mastered this unit when"), "the mastery check");
  assert.ok(content.reflection.includes("What surprised me?"), "the reflection");
  assert.ok(!content.intro.startsWith("#") && content.intro.includes("self-assessed"), "the intro, without the title line");
  assert.deepEqual(checklistOf({ items: [{ text: "ok", checked: true }, { text: 5 }, "x"] }), [{ text: "ok", checked: true }], "a malformed stored item is left out");
});

done();
