/**
 * Publishes the course index into the database (T06). Developer tool only:
 * never imported by the app, and it lives outside src/.
 *
 *   ACADEMY_DATABASE_URL=postgresql://... node scripts/publish-content.mjs           show what would change
 *   ACADEMY_DATABASE_URL=postgresql://... node scripts/publish-content.mjs --apply   write it
 *
 * ACADEMY_DATABASE_URL is the database owner's connection string (Supabase:
 * Project Settings → Database → Connection string). Keep it in your shell, never in a file.
 * Run `npm run content` first so index.json and manifest.json are current.
 */
import { readFileSync } from "node:fs";
import pg from "pg";
import { applyPublish, describePlan, planPublish } from "./lib/publish.mjs";

const url = process.env.ACADEMY_DATABASE_URL;
if (!url) {
  console.error("Set ACADEMY_DATABASE_URL to the database owner's connection string.");
  process.exit(1);
}
const read = (name) => JSON.parse(readFileSync(new URL(`../content/${name}`, import.meta.url), "utf8"));
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const query = (sql, params) => client.query(sql, params);
  const plan = await planPublish(query, read("index.json"), read("manifest.json"));
  console.log(describePlan(plan).join("\n"));
  if (plan.refused.length) process.exitCode = 1;
  else if (process.argv.includes("--apply")) {
    if (plan.items.length || plan.checks.length) { await applyPublish(query, plan); console.log("Written."); }
  } else if (plan.items.length || plan.checks.length) console.log("\nNothing written. Run again with --apply to write.");
} finally {
  await client.end();
}
