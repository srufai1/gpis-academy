/** T09 on PGlite: an attempt is inserted; it cannot be changed; another learner cannot read it. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { actAs, createUser, expectRefused, freshDatabase } from "./lib/pglite-schema.mjs";
import { applyPublish, planPublish } from "./lib/publish.mjs";

const read = (n) => JSON.parse(readFileSync(new URL(`../content/${n}`, import.meta.url), "utf8"));
const db = await freshDatabase();
await actAs(db, null);
const query = (sql, params) => db.query(sql, params);
await applyPublish(query, await planPublish(query, read("index.json"), read("manifest.json")));
const quizItem = read("index.json").items.find((i) => i.kind === "quiz");
const a = await createUser(db, { email: "a@example.test" });
const b = await createUser(db, { email: "b@example.test" });
let checks = 0;

await actAs(db, a.id);
await db.query("insert into public.quiz_attempts (user_id, item_slug, answers, score, content_hash) values ($1, $2, $3, $4, $5)",
  [a.id, quizItem.slug, { q1: 0 }, 5, quizItem.content_hash]);
await db.query("insert into public.quiz_attempts (user_id, item_slug, answers, score, content_hash) values ($1, $2, $3, $4, $5)",
  [a.id, quizItem.slug, { q1: 1 }, 7, quizItem.content_hash]);
assert.deepEqual((await db.query("select score from public.quiz_attempts order by id")).rows.map((r) => r.score), [5, 7], "every attempt is kept"); checks++;
await expectRefused(db, "update public.quiz_attempts set score = 9"); checks++;
await expectRefused(db, "delete from public.quiz_attempts"); checks++;
await expectRefused(db, "insert into public.quiz_attempts (user_id, item_slug, answers, score, content_hash) values ($1, $2, '{}', 1, $3)", [b.id, quizItem.slug, quizItem.content_hash]); checks++;

// A pass is recorded in progress as quiz_passed.
await db.query("insert into public.progress (user_id, item_slug, state) values ($1, $2, 'quiz_passed')", [a.id, quizItem.slug]);
assert.equal((await db.query("select state from public.progress where item_slug = $1", [quizItem.slug])).rows[0].state, "quiz_passed"); checks++;

await actAs(db, b.id);
assert.equal((await db.query("select count(*)::int as n from public.quiz_attempts")).rows[0].n, 0, "learner B cannot read A's attempts"); checks++;
assert.equal((await db.query("select count(*)::int as n from public.progress")).rows[0].n, 0, "learner B cannot read A's progress"); checks++;
await actAs(db, "anon");
await expectRefused(db, "select * from public.quiz_attempts"); checks++;

console.log(`Quiz database: ${checks} checks passed.`);
