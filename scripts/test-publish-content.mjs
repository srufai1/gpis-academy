/**
 * T06 on PGlite: the first run inserts; the second changes nothing; a changed
 * hash under a published version is refused; a new version is added beside the old.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { freshDatabase, actAs } from "./lib/pglite-schema.mjs";
import { applyPublish, describePlan, planPublish } from "./lib/publish.mjs";

const read = (name) => JSON.parse(readFileSync(new URL(`../content/${name}`, import.meta.url), "utf8"));
const index = read("index.json");
const manifest = read("manifest.json");
const db = await freshDatabase();
await actAs(db, null);
const query = (sql, params) => db.query(sql, params);
const count = async (table) => Number((await db.query(`select count(*)::int as n from public.${table}`)).rows[0].n);
let checks = 0;

// Without --apply nothing is written: planning only reads.
const first = await planPublish(query, index, manifest);
assert.equal(first.items.length, index.items.length); checks++;
assert.equal(first.checks.length, 1); checks++;
assert.equal(await count("content_items"), 0, "planning writes nothing"); checks++;

await applyPublish(query, first);
assert.equal(await count("content_items"), index.items.length); checks++;
assert.equal(await count("check_definitions"), 1); checks++;

// Second run: nothing to change.
const second = await planPublish(query, index, manifest);
assert.deepEqual([second.items, second.checks, second.refused], [[], [], []], "second run is a no-op"); checks++;
assert.deepEqual(describePlan(second), ["Nothing to change."]); checks++;

// A changed title is an update, not a new row.
const retitled = { ...index, items: index.items.map((i) => (i.slug === "m1" ? { ...i, title: "Command line and Git" } : i)) };
const third = await planPublish(query, retitled, manifest);
assert.deepEqual(third.items.map((c) => [c.op, c.item.slug, c.changed]), [["update", "m1", ["title"]]]); checks++;

// A changed hash under the same published version is refused, and nothing is written.
const tampered = { checks: [{ ...manifest.checks[0], sha256: "0".repeat(64) }] };
const fourth = await planPublish(query, index, tampered);
assert.equal(fourth.refused.length, 1); checks++;
await assert.rejects(applyPublish(query, fourth), /Nothing written/); checks++;
assert.equal((await db.query("select sha256 from public.check_definitions")).rows[0].sha256, manifest.checks[0].sha256, "the published hash is unchanged"); checks++;

// A new version is a new row; the old one stays.
const bumped = { checks: [{ ...manifest.checks[0], version: "1.1.0", sha256: "1".repeat(64) }] };
await applyPublish(query, await planPublish(query, index, bumped));
assert.deepEqual((await db.query("select version from public.check_definitions order by version")).rows.map((r) => r.version), ["1.0.0", "1.1.0"]); checks++;

// The app never imports the publish script.
const { spawnSync } = await import("node:child_process");
const grep = spawnSync("grep", ["-rlE", "publish-content|lib/publish", "apps/web/src"], { encoding: "utf8", cwd: new URL("..", import.meta.url).pathname });
assert.equal(grep.status, 1, `apps/web/src must not import the publish script: ${grep.stdout}`); checks++;

console.log(`Publish content: ${checks} checks passed.`);
