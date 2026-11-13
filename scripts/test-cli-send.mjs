/**
 * T20, offline: academy check sends its signed result, and academy status reads it back.
 * Real pieces: the CLI (check, send, status), the platform's request logic (T19 verify.ts),
 * the signing code, the migrations and record_check_run() on PGlite (every query as the
 * learner, RLS applies). Fake: the network (a fetch that calls that logic) and the steps.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { actAs, as, createUser, freshDatabase, rows } from "./lib/pglite-schema.mjs";

const home = mkdtempSync(join(tmpdir(), "academy-send-home-"));
const checks = mkdtempSync(join(tmpdir(), "academy-send-checks-"));
process.env.HOME = home;
process.env.ACADEMY_CHECKS_DIR = checks;

const { check } = await import("../packages/checker/src/commands/check.ts");
const { status } = await import("../packages/checker/src/commands/status.ts");
const { prepareSend, sendResult } = await import("../packages/checker/src/send.ts");
const { loadCheck } = await import("../packages/checker/src/checks.ts");
const { saveSession, deleteSession } = await import("../packages/checker/src/session.ts");
const { saveDeviceKey, readDeviceKey } = await import("../packages/checker/src/device-key.ts");
const { generateDeviceKeyPair } = await import("../packages/shared/src/signing.ts");
const { bearerToken } = await import("../packages/shared/src/device.ts");
const { challengeRequest, submitRequest, recordErrorFrom } = await import("../apps/web/src/lib/check-runs/verify.ts");
const { toRunViews } = await import("../apps/web/src/lib/check-runs/read.ts");

let n = 0;
const ok = (v, label) => { assert.ok(v, label); n++; };
const eq = (a, b, label) => { assert.deepEqual(a, b, label); n++; };

const PLATFORM = "https://academy.example.test";
let clockMs = Date.UTC(2026, 10, 13, 21, 0, 0);
const now = () => clockMs;
const keys = { challengeKey: Buffer.alloc(32, 0x5a), recordKey: Buffer.alloc(32, 0x6b) };

/* --------------------------------------------------------------- a check with controllable steps */
const outcomes = { files: "pass", tests: "pass" };
const kinds = {
  files: () => ({ outcome: outcomes.files, reasons: outcomes.files === "pass" ? [] : ["reports/term-1/class-list.txt is missing."] }),
  tests: () => ({ outcome: outcomes.tests, reasons: outcomes.tests === "pass" ? [] : ["score 79 → expected \"Higher\", got \"High\""] }),
};
mkdirSync(join(checks, "m9-p1", "check"), { recursive: true });
writeFileSync(join(checks, "m9-p1", "check", "check.yaml"), `id: m9-p1
title: Grading scale
version: 1.0.0
unit: fake-unit
steps:
  - { id: list, kind: files, title: "The class list is in reports/term-1", required: true }
  - { id: grade, kind: tests, title: "grade() gives the right remark", required: true }
`);
const loaded = loadCheck("m9-p1");

/* --------------------------------------------------------------- the database */
const db = await freshDatabase();
await db.exec(`
  insert into public.content_items (slug, kind, parent_slug, position, title, guidance, content_hash) values
    ('m9', 'module', null, 9, 'Fake module', 'guided', '${"ab".repeat(32)}'),
    ('m9-p1', 'project', 'm9', 1, 'Grading scale', 'guided', '${"ab".repeat(32)}');
`);
await db.query("insert into public.check_definitions (item_slug, version, sha256) values ('m9-p1', '1.0.0', $1)", [loaded.sha256]);
await db.query("insert into private.server_keys (name, key) values ('record', $1)", [keys.recordKey]);
const a = await createUser(db, { email: "a@example.test" });
const pair = generateDeviceKeyPair();
const [{ id: deviceId }] = await as(db, a.id, () => rows(db, "select public.register_device($1, 'laptop') id", [pair.publicKey]));

/* --------------------------------------------------------------- the CLI's files (as academy login leaves them) */
const TOKEN = "access-" + "x".repeat(40);
const tokens = new Map([[TOKEN, a.id]]);
const signIn = () => saveSession({ supabase_url: "https://project.example.test", publishable_key: "sb_publishable_x", platform_url: PLATFORM,
  email: a.email, access_token: TOKEN, refresh_token: "refresh-" + "y".repeat(40), expires_at: Math.floor(clockMs / 1000) + 86400 });
signIn();
saveDeviceKey({ platform_url: PLATFORM, device_id: deviceId, public_key: pair.publicKey, private_seed: pair.privateSeed });

/* --------------------------------------------------------------- the fake network: the real platform logic */
const store = (userId) => ({
  async ownDevice(id) {
    const [d] = await as(db, userId, () => rows(db, "select id, public_key, revoked_at from public.devices where id = $1", [id]));
    return d ? { id: d.id, publicKey: d.public_key, revoked: d.revoked_at !== null } : null;
  },
  async definition(checkId, version) {
    const all = await as(db, userId, () => rows(db, "select id, version, sha256 from public.check_definitions where item_slug = $1 order by id desc", [checkId]));
    const row = all.find((r) => r.version === version);
    return row ? { id: Number(row.id), sha256: row.sha256, current: all[0].version === version } : null;
  },
  async record(input) {
    try {
      const [r] = await as(db, userId, () => rows(db, "select public.record_check_run($1, $2, $3, $4, $5, $6) id",
        [input.deviceId, input.definitionId, input.nonce, input.payload, input.signature, input.stamp]));
      return { id: Number(r.id) };
    } catch (error) {
      await actAs(db, null);
      return recordErrorFrom(error.code);
    }
  },
});
const net = { calls: 0, down: new Set(), seen: [] };
const fakeFetch = async (url, init = {}) => {
  net.calls++;
  const u = new URL(url);
  if (net.down.has(u.pathname)) throw new TypeError("fetch failed");
  net.seen.push(JSON.stringify(init.headers ?? {}) + (init.body ?? ""));
  const user = tokens.get(bearerToken(new Headers(init.headers).get("authorization")));
  if (!user) return Response.json({ error: "sign_in", message: "Sign-in needed: run npx academy login." }, { status: 401 });
  const deps = { store: store(user), keys, now: () => Math.floor(clockMs / 1000) };
  let out;
  if (u.pathname === "/api/check-runs/challenge") out = await challengeRequest(user, JSON.parse(init.body), deps);
  else if (u.pathname === "/api/check-runs" && init.method === "POST") out = await submitRequest(user, JSON.parse(init.body), deps);
  else if (u.pathname === "/api/check-runs/recent") {
    const found = await as(db, user, () => rows(db, `select r.id, r.passed, r.commit_sha, r.tree_clean, r.checker_version, r.created_at::text, r.results,
      json_build_object('item_slug', d.item_slug, 'version', d.version) check_definitions
      from public.check_runs r join public.check_definitions d on d.id = r.definition_id order by r.id desc limit 10`));
    const views = toRunViews(found, new Map([["m9-p1", "1.0.0"]]));
    out = { status: 200, body: { runs: views.map((v) => ({ run_id: v.id, check_id: v.checkId, version: v.version, current_version: v.currentVersion, passed: v.passed, commit_sha: v.commitSha, recorded_at: v.recordedAt })) } };
  } else out = { status: 404, body: { error: "not_found" } };
  return Response.json(out.body, { status: out.status });
};

/* --------------------------------------------------------------- a Git work folder */
const work = mkdtempSync(join(tmpdir(), "academy-send-work-"));
const git = (...args) => spawnSync("git", ["-C", work, "-c", "user.name=Learner", "-c", "user.email=l@example.test", ...args], { encoding: "utf8" });
git("init", "-q");
writeFileSync(join(work, "notes.md"), "first\n");
git("add", "."); git("commit", "-q", "-m", "First commit");
const head = git("rev-parse", "HEAD").stdout.trim();

const run = async (options = {}) => {
  const lines = [];
  const code = await check("m9-p1", { dryRun: false, dir: work, fetch: fakeFetch, now, ...options }, kinds, (l) => lines.push(...String(l).split("\n")));
  return { code, lines, last: lines.find((l) => l.startsWith("Result:")) };
};
const runsInDb = () => rows(db, "select id, passed, commit_sha, tree_clean, checker_version from public.check_runs order by id");
const secretsOk = (label) => ok(!net.seen.some((s) => s.includes(pair.privateSeed)), `${label}: the private key never leaves the computer`);

/* --------------------------------------------------------------- the cases */
outcomes.tests = "fail";
let r = await run();
eq(r.code, 1, "a not-passed check exits 1");
ok(/^Result: NOT PASSED · recorded on the platform \(run \d+\)$/.test(r.last), `a not-passed result is recorded too: ${r.last}`);
ok(r.lines.some((l) => l.includes("score 79")), "the reasons print locally");
eq((await runsInDb()).map((x) => [x.passed, x.commit_sha, x.tree_clean]), [[false, head, true]], "the platform holds the run, its commit and a clean tree");
secretsOk("send");

outcomes.tests = "pass";
writeFileSync(join(work, "notes.md"), "changed but not committed\n");
r = await run();
eq(r.code, 0, "a passed check exits 0");
ok(/^Result: PASSED · recorded on the platform \(run \d+\)$/.test(r.last), r.last);
eq((await runsInDb()).at(-1).tree_clean, false, "uncommitted changes are recorded as 'not clean'");
git("checkout", "--", "notes.md");

net.calls = 0;
r = await run({ dryRun: true });
eq([r.code, net.calls], [0, 0], "--dry-run sends nothing, not even a challenge");
ok(r.last.endsWith("dry run, nothing sent"), r.last);

const before = (await runsInDb()).length;
net.down.add("/api/check-runs/challenge");
r = await run();
eq(r.code, 0, "offline: the exit code still says whether the work passed");
ok(r.lines.some((l) => l.includes("PASS  files")) && r.last === `Result: PASSED · not recorded: could not reach the platform at ${PLATFORM}.`, `offline before the run: ${r.last}`);
net.down.clear();
net.down.add("/api/check-runs");
r = await run();
ok(r.last.startsWith("Result: PASSED · not recorded: could not reach the platform") && r.last.includes("when you are online"), `offline at sending: ${r.last}`);
net.down.clear();
eq((await runsInDb()).length, before, "nothing was recorded while offline");

{
  // The platform recorded it but the answer was lost: sending again is "already recorded", treated as success.
  const prepared = await prepareSend({ id: loaded.id, version: loaded.version, sha256: loaded.sha256 }, { fetch: fakeFetch, now });
  const s = Math.floor(clockMs / 1000);
  const runData = { check: { id: loaded.id, version: loaded.version, sha256: loaded.sha256 }, steps: [{ id: "list", kind: "files", title: "The class list is in reports/term-1", required: true, outcome: "fail", reasons: ["missing"] }], passed: false, startedAt: s, finishedAt: s, commit: { sha: null, clean: null } };
  const first = await sendResult(prepared.ticket, runData, { fetch: fakeFetch, now });
  const again = await sendResult(prepared.ticket, runData, { fetch: fakeFetch, now });
  eq([first.recorded, again.recorded, again.note], [true, true, "recorded on the platform"], "a retry of the same run counts as recorded, and is stored once");
}

{
  // A run longer than the challenge's 15 minutes is not sent.
  const slow = { files: async () => { clockMs += 16 * 60_000; return { outcome: "pass", reasons: [] }; }, tests: kinds.tests };
  const lines = [];
  await check("m9-p1", { dryRun: false, dir: work, fetch: fakeFetch, now }, slow, (l) => lines.push(...String(l).split("\n")));
  ok(lines.at(-1).includes("not recorded: the check took longer than 15 minutes"), lines.at(-1));
}

await as(db, a.id, () => db.query("update public.devices set revoked_at = now() where id = $1", [deviceId]));
r = await run();
ok(r.last.includes("not recorded: This device is not registered for your account, or it was revoked."), `revoked device: ${r.last}`);
// A revoked device stays revoked: register a new one for the cases below.
const pair2 = generateDeviceKeyPair();
const [{ id: device2 }] = await as(db, a.id, () => rows(db, "select public.register_device($1, 'laptop 2') id", [pair2.publicKey]));
saveDeviceKey({ platform_url: PLATFORM, device_id: device2, public_key: pair2.publicKey, private_seed: pair2.privateSeed });

await db.query("insert into public.check_definitions (item_slug, version, sha256) values ('m9-p1', '1.1.0', $1)", ["cd".repeat(32)]);
r = await run();
ok(r.last.includes("not recorded:") && r.last.includes("Update the checker"), `a newer published version: ${r.last}`);

deleteSession();
r = await run();
eq(r.last, "Result: PASSED · not recorded: you are not signed in on this computer. Run npx academy login.", "not signed in");
signIn();
tokens.clear();
r = await run();
ok(r.last.includes("not recorded: Sign-in needed"), `a token the platform refuses: ${r.last}`);
tokens.set(TOKEN, a.id);

{
  const lines = [];
  eq(await status("m9-p1", { fetch: fakeFetch, now, print: (l) => lines.push(l) }), 0, "status exits 0");
  ok(lines[0] === `Signed in as ${a.email} on ${PLATFORM}` && lines.some((l) => /PASSED +m9-p1 +v1\.0\.0 .* run \d+/.test(l)), lines.join("\n"));
  ok(!lines.join("\n").includes(TOKEN) && !lines.join("\n").includes(readDeviceKey().private_seed), "status prints no token and no key");
}

console.log(`CLI send: ${n} checks passed.`);
