/**
 * Step kind "sql" (T16): queries the learner's LAB database.
 *   setup:   SQL run first, inside the scratch schema (optional)
 *   queries: [{ sql, expect_rows: [...] }  |  { sql, expect_count: n }  |  { sql, expect_error: true }]
 *
 * Safety:
 * - The connection is LAB_DATABASE_URL in the project's .env, nothing else.
 * - The lab guard: the database must hold public.academy_lab with purpose = 'ruftech-academy lab'
 *   (made in the course's database setup). Without it the step stops before running anything,
 *   so a check never touches GPIS or any other real database.
 * - Everything runs in one transaction, in a scratch schema, and is ROLLED BACK: no change stays.
 */
import { randomBytes } from "node:crypto";
import pg from "pg";
import { CheckerError } from "../errors.ts";
import type { SqlClient, StepKindImpl } from "../runner.ts";
import { readEnvFile } from "./env-file.ts";

export const LAB_URL_VARIABLE = "LAB_DATABASE_URL";
export const LAB_GUARD_SQL = "select purpose from public.academy_lab limit 1";
export const LAB_PURPOSE = "ruftech-academy lab";

type Query = { sql?: string; expect_rows?: unknown[]; expect_count?: number; expect_error?: boolean };

async function pgConnect(connectionString: string): Promise<SqlClient> {
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000, statement_timeout: 20000 });
  await client.connect();
  return {
    exec: (sql) => client.query(sql),
    query: async (sql) => ({ rows: (await client.query(sql)).rows }),
    end: () => client.end(),
  };
}

const normal = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? Number(x) : x instanceof Date ? x.toISOString() : x));

export const sqlStep: StepKindImpl = async (step, ctx) => {
  const queries = step.queries as Query[] | undefined;
  if (!Array.isArray(queries) || queries.length === 0 || queries.some((q) => typeof q.sql !== "string")) throw new CheckerError("a sql step needs a list of queries, each with sql");
  const url = readEnvFile(ctx.workDir)[LAB_URL_VARIABLE];
  if (!url) return { outcome: "needs", reasons: [`Add ${LAB_URL_VARIABLE} (your lab database) to the project's .env`] };

  let db: SqlClient;
  try { db = await (ctx.connect ?? pgConnect)(url); } catch {
    return { outcome: "needs", reasons: [`Could not connect to the lab database in ${LAB_URL_VARIABLE}. Is it running, and is the address right?`] };
  }
  try {
    try {
      const guard = await db.query(LAB_GUARD_SQL);
      if (guard.rows[0]?.purpose !== LAB_PURPOSE) throw new Error("wrong purpose");
    } catch {
      return { outcome: "needs", reasons: [`This database is not marked as your lab (public.academy_lab). The checker only runs SQL on a lab database; see Module 4's setup.`] };
    }
    const scratch = `academy_check_${randomBytes(6).toString("hex")}`;
    const reasons: string[] = [];
    await db.exec("begin");
    try {
      await db.exec(`create schema ${scratch}; set local search_path = ${scratch}, public;`);
      if (typeof step.setup === "string") await db.exec(step.setup);
      for (const [i, q] of queries.entries()) {
        const label = `query ${i + 1}`;
        await db.exec(`savepoint q${i}`);
        try {
          const { rows } = await db.query(q.sql!);
          if (q.expect_error) reasons.push(`${label} should have been refused, but it ran`);
          if (q.expect_count !== undefined && rows.length !== q.expect_count) reasons.push(`${label} returned ${rows.length} rows, expected ${q.expect_count}`);
          if (q.expect_rows !== undefined && normal(rows) !== normal(q.expect_rows)) reasons.push(`${label} returned ${normal(rows).slice(0, 120)}, expected ${normal(q.expect_rows).slice(0, 120)}`);
          await db.exec(`release savepoint q${i}`);
        } catch (error) {
          await db.exec(`rollback to savepoint q${i}`);
          if (!q.expect_error) reasons.push(`${label} failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } finally {
      await db.exec("rollback");
    }
    return { outcome: reasons.length ? "fail" : "pass", reasons };
  } finally {
    await db.end().catch(() => {});
  }
};
