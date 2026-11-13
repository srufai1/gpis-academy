/** T16: the sql step on PGlite: needs .env, refuses a database that is not a lab, compares rows, and changes nothing. */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { sqlStep } from "../packages/checker/src/steps/sql.ts";

const project = mkdtempSync(join(tmpdir(), "academy-sql-"));
const db = new PGlite();
await db.exec(`create table public.students (id int primary key, name text not null, status text not null);
  insert into public.students values (1, 'Ama', 'active'), (2, 'Kofi', 'withdrawn'), (3, 'Esi', 'active');`);
const connect = async () => ({ exec: (s) => db.exec(s), query: (s) => db.query(s), end: async () => {} });
const ctx = { workDir: project, checkDir: project, connect };
const step = (extra) => ({ id: "q", kind: "sql", title: "Q", required: true, ...extra });
let n = 0;
const eq = (a, b, label) => { assert.deepEqual(a, b, label); n++; };

try {
  const q = step({ queries: [{ sql: "select name from students where status = 'active' order by id", expect_rows: [{ name: "Ama" }, { name: "Esi" }] }] });
  eq((await sqlStep(q, ctx)).outcome, "needs", "no .env: needs, not fail");
  writeFileSync(join(project, ".env"), `# my lab\nLAB_DATABASE_URL="postgresql://lab"\n`);
  const noGuard = await sqlStep(q, ctx);
  eq(noGuard.outcome, "needs", "a database without the lab marker is refused before any query");
  assert.match(noGuard.reasons[0], /not marked as your lab/); n++;
  await db.exec(`create table public.academy_lab (purpose text not null); insert into public.academy_lab values ('ruftech-academy lab');`);

  eq(await sqlStep(q, ctx), { outcome: "pass", reasons: [] }, "the expected rows: pass");
  const wrong = await sqlStep(step({ queries: [{ sql: "select name from students order by id", expect_count: 2 }] }), ctx);
  eq(wrong.reasons, ["query 1 returned 3 rows, expected 2"]);
  const bad = await sqlStep(step({ queries: [{ sql: "select nme from students" }] }), ctx);
  assert.match(bad.reasons[0], /query 1 failed: column "nme" does not exist/); n++;
  eq((await sqlStep(step({ queries: [{ sql: "insert into students values (1, 'Dup', 'active')", expect_error: true }] }), ctx)).outcome, "pass", "an expected refusal (duplicate key) passes");

  // A check's setup and the learner's queries change nothing that stays.
  const writes = step({ setup: "create table practice (n int); insert into practice values (1), (2);", queries: [
    { sql: "select count(*)::int as n from practice", expect_rows: [{ n: 2 }] },
    { sql: "update students set status = 'withdrawn' returning id", expect_count: 3 },
    { sql: "select count(*)::int as n from students where status = 'active'", expect_rows: [{ n: 0 }] },
  ] });
  eq((await sqlStep(writes, ctx)).outcome, "pass", "inside the run, the changes are visible");
  eq((await db.query("select count(*)::int as n from students where status = 'active'")).rows, [{ n: 2 }], "after the run, the learner's rows are unchanged");
  eq((await db.query("select count(*)::int as n from information_schema.schemata where schema_name like 'academy_check_%'")).rows, [{ n: 0 }], "no scratch schema is left behind");
  eq((await db.query("select to_regclass('public.practice') is null as gone")).rows, [{ gone: true }], "the setup table is gone");

  // Wrong purpose, and a connection that fails.
  await db.exec("update public.academy_lab set purpose = 'production'");
  eq((await sqlStep(q, ctx)).outcome, "needs", "a marker with the wrong purpose is refused");
  eq((await sqlStep(q, { ...ctx, connect: async () => { throw new Error("ECONNREFUSED"); } })).outcome, "needs", "no database answering: needs");
} finally {
  rmSync(project, { recursive: true, force: true });
  await db.close();
}
console.log(`Step sql: ${n} checks passed.`);
