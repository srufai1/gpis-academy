/**
 * T04: quiz_attempts, check_runs and reviews are history.
 *   - UPDATE, DELETE and TRUNCATE are refused for every role, the owner included;
 *   - check_runs accepts no direct INSERT from any API role (T19 adds the one door);
 *   - the table is shaped for that door: one result per nonce, a device of the same learner.
 */
import assert from "node:assert/strict";
import { as, expectRefused, freshDatabase, rows, runner } from "./lib/pglite-schema.mjs";
import { CHECK_RUN_INSERT, seed } from "./lib/schema-fixtures.mjs";

const HISTORY = ["quiz_attempts", "check_runs", "reviews"];
const db = await freshDatabase();
const f = await seed(db);
const { test, done } = runner("Immutable history");
const snapshot = () => rows(db, `select
  (select jsonb_agg(to_jsonb(q) order by q.id) from public.quiz_attempts q) quiz,
  (select jsonb_agg(to_jsonb(c) order by c.id) from public.check_runs c) runs,
  (select jsonb_agg(to_jsonb(r) order by r.id) from public.reviews r) reviews`);
const before = await snapshot();

await test("a learner cannot update or delete own history (no privilege)", async () => {
  await as(db, f.a.id, async () => {
    for (const table of HISTORY) {
      await expectRefused(db, `update public.${table} set created_at = now()`, [], /permission denied/);
      await expectRefused(db, `delete from public.${table}`, [], /permission denied/);
      await expectRefused(db, `truncate public.${table}`, [], /permission denied|must be owner/);
    }
    await expectRefused(db, "update public.quiz_attempts set score = 1000", [], /permission denied/);
    await expectRefused(db, "update public.check_runs set passed = true", [], /permission denied/);
    await expectRefused(db, "update public.reviews set explanation = 'better'", [], /permission denied/);
  });
});

await test("signed-out visitors and the service role cannot touch history", async () => {
  for (const who of ["anon", "service"]) {
    await as(db, who, async () => {
      for (const table of HISTORY) {
        await expectRefused(db, `update public.${table} set created_at = now()`, [], /permission denied/);
        await expectRefused(db, `delete from public.${table}`, [], /permission denied/);
      }
    });
  }
});

await test("the trigger refuses UPDATE, DELETE and TRUNCATE for the database owner too", async () => {
  for (const table of HISTORY) {
    await expectRefused(db, `update public.${table} set created_at = now()`, [], /history rows cannot be changed/);
    await expectRefused(db, `delete from public.${table}`, [], /history rows cannot be changed/);
    await expectRefused(db, `truncate public.${table}`, [], /history rows cannot be changed/);
  }
});

await test("a later mistake in grants still cannot open history", async () => {
  await db.exec("begin; grant update, delete on public.quiz_attempts, public.check_runs, public.reviews to authenticated;");
  try {
    for (const table of HISTORY) {
      await db.exec("savepoint s; create policy oops_u on public." + table + " for update to authenticated using (true) with check (true); create policy oops_d on public." + table + " for delete to authenticated using (true);");
    }
    await as(db, f.a.id, async () => {
      for (const table of HISTORY) {
        await db.exec("savepoint t");
        await expectRefused(db, `update public.${table} set created_at = now()`, [], /history rows cannot be changed/);
        await db.exec("rollback to savepoint t; savepoint t");
        await expectRefused(db, `delete from public.${table}`, [], /history rows cannot be changed/);
        await db.exec("rollback to savepoint t");
      }
    });
  } finally {
    await db.exec("rollback");
  }
});

await test("history triggers exist on exactly the three tables", async () => {
  const found = await rows(db, `select c.relname, count(*)::int n from pg_trigger g join pg_class c on c.oid = g.tgrelid
    where g.tgfoid = 'public.forbid_history_change'::regproc and not g.tgisinternal group by 1 order by 1`);
  assert.deepEqual(found, [{ relname: "check_runs", n: 2 }, { relname: "quiz_attempts", n: 2 }, { relname: "reviews", n: 2 }]);
});

await test("check_runs refuses a direct INSERT from every API role, even a perfectly valid row", async () => {
  const args = [f.a.id, f.a.deviceId, f.definitionId, "nonce-direct-0123456789abcdef"];
  for (const who of [f.a.id, f.b.id, "anon", "service"]) {
    await as(db, who, () => expectRefused(db, CHECK_RUN_INSERT, args, /permission denied/));
  }
  const [p] = await rows(db, `select has_table_privilege('authenticated', 'public.check_runs', 'insert') t,
    has_any_column_privilege('authenticated', 'public.check_runs', 'insert') c`);
  assert.deepEqual(p, { t: false, c: false });
  const policies = await rows(db, "select cmd from pg_policies where schemaname = 'public' and tablename = 'check_runs'");
  assert.deepEqual(policies, [{ cmd: "SELECT" }], "no INSERT policy either");
  // The same row is accepted from the owner: only the missing door stopped it.
  await db.exec("begin");
  try { await db.query(CHECK_RUN_INSERT, args); } finally { await db.exec("rollback"); }
});

await test("no function yet lets an API role write check_runs (T19 adds the only one)", async () => {
  const writers = await rows(db, `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosrc ~* 'check_runs'`);
  assert.deepEqual(writers, []);
});

await test("the table fits the T19 door: one result per nonce; the device must be the learner's own", async () => {
  const insert = (user, device, nonce) => db.query(CHECK_RUN_INSERT, [user, device, f.definitionId, nonce]);
  await db.exec("begin");
  try {
    await db.exec("savepoint s");
    await expectRefused(db, CHECK_RUN_INSERT, [f.a.id, f.a.deviceId, f.definitionId, "nonce-a-0123456789abcdef"], /unique|duplicate/);
    await db.exec("rollback to savepoint s; savepoint s");
    // Learner A's run cannot name learner B's device.
    await expectRefused(db, CHECK_RUN_INSERT, [f.a.id, f.b.deviceId, f.definitionId, "nonce-cross-0123456789abcdef"], /foreign key/);
    await db.exec("rollback to savepoint s; savepoint s");
    await expectRefused(db, CHECK_RUN_INSERT, [f.a.id, f.a.deviceId, 999999, "nonce-nodef-0123456789abcdef"], /foreign key/);
    await db.exec("rollback to savepoint s; savepoint s");
    await expectRefused(db, CHECK_RUN_INSERT, [f.a.id, f.a.deviceId, f.definitionId, "short"], /check constraint/);
    await db.exec("rollback to savepoint s");
    await insert(f.a.id, f.a.deviceId, "nonce-second-0123456789abcdef");
  } finally {
    await db.exec("rollback");
  }
});

await test("a learner with history cannot be removed by accident", async () => {
  await expectRefused(db, "delete from auth.users where id = $1", [f.a.id], /foreign key|history rows cannot be changed/);
  await expectRefused(db, "delete from public.devices where id = $1", [f.a.deviceId], /foreign key/);
});

await test("after every refused attempt, history is byte for byte what it was", async () => {
  assert.deepEqual(await snapshot(), before);
});

await db.close();
done();
