/**
 * A disposable, in-memory PostgreSQL (PGlite) with every migration applied.
 * Test-only: no network, no real database, no Supabase CLI.
 *
 *   import { freshDatabase, actAs, createUser, expectRefused } from "./lib/pglite-schema.mjs";
 *   const db = await freshDatabase();
 *   const a = await createUser(db, { email: "a@example.test" });
 *   await actAs(db, a.id);            // the next statements run as that learner
 *   await actAs(db, "anon");          // a signed-out visitor
 *   await actAs(db, null);            // back to the database owner (migrations, fixtures)
 *
 * The scaffold copies what Supabase sets up before any migration runs:
 * the anon, authenticated and service_role roles; auth.users; auth.uid(),
 * auth.jwt() and auth.role(); and the DEFAULT PRIVILEGES that give those roles
 * ALL on every new public table and EXECUTE on every new function. That last
 * part matters: a migration that forgets to revoke is caught here, as it would
 * be open on the real project.
 * It is not Supabase Auth or PostgREST; it only lets the SQL run.
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const migrationsDir = fileURLToPath(new URL("../../supabase/migrations/", import.meta.url));

const SCAFFOLD = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create role supabase_auth_admin nologin;

  -- Supabase keeps extensions in their own schema.
  create schema extensions;
  grant usage on schema extensions to anon, authenticated, service_role;

  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role, supabase_auth_admin;
  grant usage on schema public to anon, authenticated, service_role;

  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_app_meta_data jsonb not null default '{}'::jsonb,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
  );

  -- Same reading order as Supabase: the single claim first, then the claims object.
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                           auth.jwt() ->> 'sub'), '')::uuid
  $$;
  create function auth.role() returns text language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), auth.jwt() ->> 'role')
  $$;
  grant execute on function auth.jwt(), auth.uid(), auth.role() to anon, authenticated, service_role;

  -- Supabase's defaults for objects the owner creates in public.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

/** The migration file names, in the order they are applied. */
export function migrationFiles() {
  return readdirSync(migrationsDir).filter((f) => /^\d+_.*\.sql$/.test(f)).sort();
}

/**
 * A new database with the scaffold and the migrations.
 * `upTo` stops after that file (to test an upgrade); `extra` is SQL run after.
 */
export async function freshDatabase({ upTo = null, extra = [] } = {}) {
  // pgcrypto is offered, not installed: the migration that needs it creates it (as on Supabase).
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SCAFFOLD);
  for (const file of migrationFiles()) {
    try {
      await db.exec(readFileSync(migrationsDir + file, "utf8"));
    } catch (error) {
      error.message = `${file}: ${error.message}`;
      throw error;
    }
    if (upTo && file === upTo) break;
  }
  for (const sql of extra) await db.exec(sql);
  return db;
}

/**
 * Run the following statements as someone.
 *   actAs(db, "<uuid>")                      a signed-in learner
 *   actAs(db, "<uuid>", { role: "admin" })   with app_metadata (the only source of a role)
 *   actAs(db, "anon")                        a signed-out visitor
 *   actAs(db, "service")                     the service role (the app never uses it)
 *   actAs(db, null)                          the database owner
 */
export async function actAs(db, who, appMetadata = {}) {
  await db.exec("reset role");
  if (who === null || who === undefined) {
    await db.exec(`select set_config('request.jwt.claims', '', false), set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claim.role', '', false)`);
    return;
  }
  const dbRole = who === "anon" ? "anon" : who === "service" ? "service_role" : "authenticated";
  const claims = dbRole === "authenticated"
    ? { sub: who, role: "authenticated", app_metadata: appMetadata }
    : { role: dbRole };
  await db.query(
    `select set_config('request.jwt.claims', $1, false), set_config('request.jwt.claim.sub', $2, false), set_config('request.jwt.claim.role', $3, false)`,
    [JSON.stringify(claims), claims.sub ?? "", dbRole],
  );
  await db.exec(`set role ${dbRole}`);
}

/** Do something as someone, then return to the database owner. */
export async function as(db, who, run, appMetadata) {
  await actAs(db, who, appMetadata);
  try {
    return await run();
  } finally {
    await actAs(db, null);
  }
}

/** Sign a learner up the way Auth does: a row in auth.users (the trigger makes the profile). */
export async function createUser(db, { email, fullName = "", appMetadata = {} } = {}) {
  await actAs(db, null);
  const { rows } = await db.query(
    `insert into auth.users (email, raw_app_meta_data, raw_user_meta_data) values ($1, $2, $3) returning id`,
    [email, appMetadata, fullName ? { full_name: fullName } : {}],
  );
  return { id: rows[0].id, email };
}

/** Rows of a query, as plain objects. */
export async function rows(db, sql, params = []) {
  return (await db.query(sql, params)).rows;
}

/**
 * The statement must fail. Returns the error message.
 * Runs inside a savepoint-free transaction of its own, so a refusal leaves no trace.
 */
export async function expectRefused(db, sql, params = [], pattern = /./) {
  let message = null;
  try {
    await db.query(sql, params);
  } catch (error) {
    message = error.message;
  }
  if (message === null) throw new Error(`Expected a refusal, but it was allowed: ${sql}`);
  if (!pattern.test(message)) throw new Error(`Refused, but for another reason (${message}): ${sql}`);
  return message;
}

/** Tiny test runner shared by the database tests. */
export function runner(label) {
  let passed = 0;
  return {
    async test(name, run) {
      await run();
      passed++;
      console.log(`  ok  ${name}`);
    },
    done() {
      console.log(`${label}: ${passed} checks passed`);
    },
  };
}
