/**
 * T04: the schema and its Row-Level Security, on an in-memory database.
 *   - every table has RLS; a signed-out visitor has no privilege at all;
 *   - learner A never sees or changes learner B's rows;
 *   - the exact privileges of a signed-in learner, table by table;
 *   - the sign-up trigger; a role comes only from app_metadata;
 *   - every function pins its search_path; migrations replay from empty.
 */
import assert from "node:assert/strict";
import { as, createUser, expectRefused, freshDatabase, migrationFiles, rows, runner } from "./lib/pglite-schema.mjs";
import { seed } from "./lib/schema-fixtures.mjs";

const TABLES = ["profiles", "content_items", "progress", "quiz_attempts", "devices", "check_definitions", "check_runs", "reviews"];
const OWNED = { progress: "user_id", quiz_attempts: "user_id", devices: "user_id", check_runs: "user_id", reviews: "user_id", profiles: "id" };

const db = await freshDatabase();
const f = await seed(db);
const { test, done } = runner("Schema and RLS");

await test("the eight tables of platform.md exist, and nothing else", async () => {
  const found = (await rows(db, `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') order by 1`)).map((r) => r.relname);
  assert.deepEqual(found, [...TABLES].sort());
});

await test("every table has Row-Level Security on", async () => {
  const off = await rows(db, `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity`);
  assert.deepEqual(off, []);
});

await test("a signed-out visitor has no privilege on any table and can call no function", async () => {
  for (const table of TABLES) {
    const [p] = await rows(db, `select has_table_privilege('anon', 'public.${table}', 'select') s,
      has_table_privilege('anon', 'public.${table}', 'insert') i, has_table_privilege('anon', 'public.${table}', 'update') u,
      has_table_privilege('anon', 'public.${table}', 'delete') d, has_table_privilege('anon', 'public.${table}', 'truncate') t,
      has_any_column_privilege('anon', 'public.${table}', 'select, insert, update') c`);
    assert.deepEqual(p, { s: false, i: false, u: false, d: false, t: false, c: false }, table);
    await as(db, "anon", () => expectRefused(db, `select * from public.${table}`, [], /permission denied/));
  }
  const open = await rows(db, `select p.oid::regprocedure::text f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')`);
  assert.deepEqual(open, []);
});

await test("the service role has no privilege either (the app never uses it)", async () => {
  for (const table of TABLES) {
    const [p] = await rows(db, `select has_table_privilege('service_role', 'public.${table}', 'select, insert, update, delete, truncate') any`);
    assert.equal(p.any, false, table);
  }
});

// What a signed-in learner holds, table by table. Column lists are exact.
const MATRIX = {
  profiles: { select: true, insert: [], update: ["full_name", "time_zone"], delete: false },
  content_items: { select: true, insert: [], update: [], delete: false },
  check_definitions: { select: true, insert: [], update: [], delete: false },
  progress: { select: true, insert: ["due_on", "item_slug", "state", "user_id"], update: ["due_on", "state"], delete: false },
  quiz_attempts: { select: true, insert: ["answers", "content_hash", "item_slug", "score", "user_id"], update: [], delete: false },
  devices: { select: true, insert: [], update: ["revoked_at"], delete: false },
  check_runs: { select: true, insert: [], update: [], delete: false },
  reviews: { select: true, insert: ["checklist", "explanation", "gpis_comparison", "item_slug", "user_id"], update: [], delete: false },
};

await test("privilege matrix: a signed-in learner holds exactly the listed rights", async () => {
  for (const table of TABLES) {
    const columns = async (privilege) => (await rows(db, `select a.attname from pg_attribute a
      where a.attrelid = 'public.${table}'::regclass and a.attnum > 0 and not a.attisdropped
        and has_column_privilege('authenticated', a.attrelid, a.attnum, '${privilege}') order by 1`)).map((r) => r.attname);
    const [p] = await rows(db, `select has_table_privilege('authenticated', 'public.${table}', 'select') s,
      has_table_privilege('authenticated', 'public.${table}', 'delete') d,
      has_table_privilege('authenticated', 'public.${table}', 'truncate') t,
      has_table_privilege('authenticated', 'public.${table}', 'references') r,
      has_table_privilege('authenticated', 'public.${table}', 'trigger') g`);
    assert.equal(p.s, MATRIX[table].select, `${table} select`);
    assert.deepEqual([p.d, p.t, p.r, p.g], [false, false, false, false], `${table} delete/truncate/references/trigger`);
    assert.deepEqual(await columns("insert"), MATRIX[table].insert, `${table} insert columns`);
    assert.deepEqual(await columns("update"), MATRIX[table].update, `${table} update columns`);
  }
});

await test("policies: one per allowed action, for signed-in users only; none allows delete", async () => {
  const found = (await rows(db, `select tablename || ':' || cmd k, roles::text r from pg_policies where schemaname = 'public' order by 1`));
  assert.deepEqual(found.map((p) => p.k), [
    "check_definitions:SELECT", "check_runs:SELECT", "content_items:SELECT", "devices:SELECT", "devices:UPDATE",
    "profiles:SELECT", "profiles:UPDATE", "progress:INSERT", "progress:SELECT", "progress:UPDATE",
    "quiz_attempts:INSERT", "quiz_attempts:SELECT", "reviews:INSERT", "reviews:SELECT",
  ]);
  for (const p of found) assert.equal(p.r, "{authenticated}", p.k);
});

await test("learner A reads only A's rows; shared course rows are readable by both", async () => {
  for (const [table, column] of Object.entries(OWNED)) {
    const seen = await as(db, f.a.id, () => rows(db, `select ${column} id from public.${table}`));
    assert.ok(seen.length >= 1, `${table}: A sees own rows`);
    assert.ok(seen.every((r) => r.id === f.a.id), `${table}: A sees only own rows`);
    const other = await as(db, f.a.id, () => rows(db, `select 1 from public.${table} where ${column} = $1`, [f.b.id]));
    assert.deepEqual(other, [], `${table}: B's rows are invisible to A`);
  }
  for (const who of [f.a.id, f.b.id]) {
    assert.equal((await as(db, who, () => rows(db, "select slug from public.content_items"))).length, 4);
    assert.equal((await as(db, who, () => rows(db, "select id from public.check_definitions"))).length, 1);
  }
});

await test("learner A cannot write a row for learner B, or change B's rows", async () => {
  await as(db, f.a.id, async () => {
    await expectRefused(db, "insert into public.progress (user_id, item_slug, state) values ($1, 'm1-p1', 'started')", [f.b.id], /row-level security/);
    await expectRefused(db, `insert into public.quiz_attempts (user_id, item_slug, answers, score, content_hash) values ($1, 'm1-u1-quiz', '{}', 7, '${f.hash}')`, [f.b.id], /row-level security/);
    await expectRefused(db, "insert into public.reviews (user_id, item_slug, checklist, explanation, gpis_comparison) values ($1, 'm1-p1', '{}', 'x', 'y')", [f.b.id], /row-level security/);
    // An update that names B's rows changes nothing: they are not visible to A.
    assert.equal((await db.query("update public.progress set state = 'done' where user_id = $1", [f.b.id])).affectedRows, 0);
    assert.equal((await db.query("update public.profiles set full_name = 'Hacked' where id = $1", [f.b.id])).affectedRows, 0);
    assert.equal((await db.query("update public.devices set revoked_at = now() where user_id = $1", [f.b.id])).affectedRows, 0);
    // A cannot hand an own row over to B.
    await expectRefused(db, "update public.progress set user_id = $1", [f.b.id], /permission denied/);
  });
  const [b] = await rows(db, "select full_name from public.profiles where id = $1", [f.b.id]);
  assert.equal(b.full_name, "Learner B");
});

await test("a learner can do the allowed things on own rows", async () => {
  await as(db, f.a.id, async () => {
    await db.query("insert into public.progress (user_id, item_slug, state) values ($1, 'm1-p1', 'started')", [f.a.id]);
    assert.equal((await db.query("update public.progress set state = 'done' where item_slug = 'm1-p1'")).affectedRows, 1);
    assert.equal((await db.query("update public.profiles set full_name = 'A. Learner', time_zone = 'Africa/Accra'")).affectedRows, 1);
    await db.query(`insert into public.quiz_attempts (user_id, item_slug, answers, score, content_hash) values ($1, 'm1-u1-quiz', '{"q1":1}', 6, '${f.hash}')`, [f.a.id]);
    await db.query("insert into public.reviews (user_id, item_slug, checklist, explanation, gpis_comparison) values ($1, 'm1-p1', '{}', 'Second thoughts.', 'Same idea.')", [f.a.id]);
  });
  const revisions = (await rows(db, "select revision from public.reviews where user_id = $1 order by 1", [f.a.id])).map((r) => r.revision);
  assert.deepEqual(revisions, [1, 2], "the database numbers the revisions");
});

await test("a learner cannot set what the database owns: ids, times, revision, role columns", async () => {
  await as(db, f.a.id, async () => {
    await expectRefused(db, `insert into public.quiz_attempts (user_id, item_slug, answers, score, content_hash, created_at) values ($1, 'm1-u1-quiz', '{}', 1, '${f.hash}', '2020-01-01')`, [f.a.id], /permission denied/);
    await expectRefused(db, "insert into public.reviews (user_id, item_slug, revision, checklist, explanation, gpis_comparison) values ($1, 'm1-p1', 99, '{}', 'x', 'y')", [f.a.id], /permission denied/);
    await expectRefused(db, "update public.profiles set id = gen_random_uuid()", [], /permission denied/);
    await expectRefused(db, "update public.progress set updated_at = '2020-01-01'", [], /permission denied/);
    await expectRefused(db, "insert into public.profiles (id) values (gen_random_uuid())", [], /permission denied/);
    await expectRefused(db, "delete from public.progress", [], /permission denied/);
    await expectRefused(db, "delete from public.profiles", [], /permission denied/);
  });
});

await test("course rows and devices cannot be written by a learner", async () => {
  await as(db, f.a.id, async () => {
    await expectRefused(db, `insert into public.content_items (slug, kind, position, title, content_hash) values ('x', 'module', 9, 'X', '${f.hash}')`, [], /permission denied/);
    await expectRefused(db, "update public.content_items set title = 'X'", [], /permission denied/);
    await expectRefused(db, `insert into public.check_definitions (item_slug, version, sha256) values ('m1-p1', '9.9.9', '${f.hash}')`, [], /permission denied/);
    await expectRefused(db, "update public.check_definitions set sha256 = sha256", [], /permission denied/);
    await expectRefused(db, "insert into public.devices (user_id, public_key) values ($1, $2)", [f.a.id, "ed25519:" + "z".repeat(43)], /permission denied/);
    await expectRefused(db, "update public.devices set public_key = public_key", [], /permission denied/);
  });
});

await test("a device can be revoked by its owner, once, and not un-revoked", async () => {
  await as(db, f.a.id, async () => {
    assert.equal((await db.query("update public.devices set revoked_at = '2001-01-01'")).affectedRows, 1);
    await expectRefused(db, "update public.devices set revoked_at = null", [], /stays revoked/);
    await expectRefused(db, "update public.devices set revoked_at = now() + interval '1 day'", [], /stays revoked/);
  });
  const [d] = await rows(db, "select revoked_at > now() - interval '1 minute' recent from public.devices where user_id = $1", [f.a.id]);
  assert.equal(d.recent, true, "the database sets the time of revoking, not the learner");
});

await test("sign-up creates the profile; the display name is cut to the limit", async () => {
  const c = await createUser(db, { email: "c@example.test", fullName: "N".repeat(300) });
  const [p] = await rows(db, "select full_name, time_zone from public.profiles where id = $1", [c.id]);
  assert.equal(p.full_name.length, 120);
  assert.equal(p.time_zone, "Africa/Accra");
  const d = await createUser(db, { email: "d@example.test" });
  assert.equal((await rows(db, "select full_name from public.profiles where id = $1", [d.id]))[0].full_name, "");
});

await test("a role comes only from app_metadata, never from user_metadata", async () => {
  const role = (who, meta) => as(db, who, async () => (await rows(db, "select public.app_role() r"))[0].r, meta);
  assert.equal(await role(f.a.id, { role: "admin" }), "admin");
  assert.equal(await role(f.a.id, {}), null);
  // A user-written claim is ignored.
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: f.a.id, role: "authenticated", user_metadata: { role: "admin" } })]);
  await db.exec("set role authenticated");
  try { assert.equal((await rows(db, "select public.app_role() r"))[0].r, null); } finally { await as(db, null, async () => {}); }
  const mentions = await rows(db, `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosrc ~ 'user_meta' and p.proname <> 'handle_new_user'`);
  assert.deepEqual(mentions, [], "only the sign-up trigger reads user metadata, for the display name");
  const policies = await rows(db, `select policyname from pg_policies where schemaname = 'public' and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'user_meta'`);
  assert.deepEqual(policies, []);
});

await test("every function pins search_path; trigger functions cannot be called by API roles", async () => {
  const fns = await rows(db, `select p.proname, p.prosecdef, coalesce(array_to_string(p.proconfig, ','), '') cfg, p.prorettype::regtype::text ret,
      has_function_privilege('authenticated', p.oid, 'execute') auth, has_function_privilege('public', p.oid, 'execute') pub
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' order by 1`);
  assert.deepEqual(fns.map((x) => x.proname), ["app_role", "devices_revoke_once", "forbid_history_change", "handle_new_user", "reviews_set_revision", "set_updated_at"]);
  for (const fn of fns) {
    assert.equal(fn.cfg, 'search_path=""', `${fn.proname} pins search_path to empty`);
    assert.equal(fn.pub, false, `${fn.proname}: no PUBLIC execute`);
    assert.equal(fn.auth, fn.proname === "app_role", `${fn.proname}: execute for signed-in users only where needed`);
  }
  assert.deepEqual(fns.filter((x) => x.prosecdef).map((x) => x.proname), ["handle_new_user", "reviews_set_revision"], "the only SECURITY DEFINER functions (both trigger functions)");
});

await test("constraints refuse wrong data even from the owner", async () => {
  await expectRefused(db, "insert into public.progress (user_id, item_slug, state) values ($1, 'm1', 'finished')", [f.a.id], /check constraint/);
  await expectRefused(db, `insert into public.quiz_attempts (user_id, item_slug, answers, score, content_hash) values ($1, 'm1-u1-quiz', '{}', -1, '${f.hash}')`, [f.a.id], /check constraint/);
  await expectRefused(db, `insert into public.check_definitions (item_slug, version, sha256) values ('m1-p1', '1.0.0', '${f.hash}')`, [], /unique/);
  await expectRefused(db, `insert into public.check_definitions (item_slug, version, sha256) values ('m1-p1', 'v2', '${f.hash}')`, [], /check constraint/);
  await expectRefused(db, `insert into public.content_items (slug, kind, position, title, content_hash) values ('Bad Slug', 'module', 1, 'X', '${f.hash}')`, [], /check constraint/);
});

await test("migrations replay from an empty database, and a second database is identical", async () => {
  assert.ok(migrationFiles().length >= 5);
  const again = await freshDatabase();
  const shape = (d) => rows(d, `select c.relname, a.attname, a.atttypid::regtype::text t, a.attnotnull from pg_attribute a
    join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped order by 1, 2`);
  assert.deepEqual(await shape(again), await shape(db));
  await again.close();
});

await db.close();
done();
