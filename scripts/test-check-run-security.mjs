/**
 * T19: the only door into check_runs, end to end and offline.
 * The real request logic (apps/web/src/lib/check-runs/verify.ts), the real signing code and
 * the real migrations run together; only Supabase is replaced, by an in-memory database
 * where every query runs as the learner (RLS applies).
 *
 * Every case of "What this stops" in docs/checker.md fails here, plus: a direct call of
 * record_check_run() without the route's stamp, and no Bearer token, an expired token and
 * a cookie-only request each get 401.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bearerToken } from "../packages/shared/src/device.ts";
import { generateDeviceKeyPair, issueChallenge, recordStamp, sha256Hex, signResult } from "../packages/shared/src/signing.ts";
import {
  challengeRequest, cliRoute, recordErrorFrom, submitRequest, MAX_CHALLENGE_BODY, MAX_SUBMISSION_BODY,
} from "../apps/web/src/lib/check-runs/verify.ts";
import { actAs, as, createUser, expectRefused, freshDatabase, rows, runner } from "./lib/pglite-schema.mjs";

const HASH = "ab".repeat(32);
const CHECK = { id: "m1-p1", version: "1.0.0", sha256: HASH };
const keys = { challengeKey: Buffer.alloc(32, 0xc1), recordKey: Buffer.alloc(32, 0xd2) };
let clock = 1794000000;
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

/* ------------------------------------------------------------------ database */
const db = await freshDatabase();
await db.exec(`
  insert into public.content_items (slug, kind, parent_slug, position, title, guidance, content_hash) values
    ('m1', 'module', null, 1, 'Command line and Git', 'guided', '${HASH}'),
    ('m1-p1', 'project', 'm1', 1, 'Find your way', 'guided', '${HASH}'),
    ('m1-p2', 'project', 'm1', 2, 'Log report', 'guided', '${HASH}');
  insert into public.check_definitions (item_slug, version, sha256) values ('m1-p1', '1.0.0', '${HASH}'), ('m1-p2', '1.0.0', '${HASH}');
`);
// The owner's one manual step (docs/runbook-check-runs.md): the same record key as the route's.
await db.query("insert into private.server_keys (name, key) values ('record', $1)", [keys.recordKey]);

async function learner(email) {
  const user = await createUser(db, { email });
  const pair = generateDeviceKeyPair();
  const [{ id }] = await as(db, user.id, () => rows(db, "select public.register_device($1, 'laptop') id", [pair.publicKey]));
  return { ...user, deviceId: id, ...pair };
}
const A = await learner("a@example.test");
const B = await learner("b@example.test");

/** The store the route would build, but on PGlite: the same three queries, as the learner. */
const storeFor = (userId) => ({
  calls: 0,
  async ownDevice(deviceId) {
    this.calls++;
    const [d] = await as(db, userId, () => rows(db, "select id, public_key, revoked_at from public.devices where id = $1", [deviceId]));
    return d ? { id: d.id, publicKey: d.public_key, revoked: d.revoked_at !== null } : null;
  },
  async definition(checkId, version) {
    this.calls++;
    const all = await as(db, userId, () => rows(db, "select id, version, sha256 from public.check_definitions where item_slug = $1 order by id desc", [checkId]));
    const row = all.find((r) => r.version === version);
    return row ? { id: Number(row.id), sha256: row.sha256, current: all[0].version === version } : null;
  },
  async record(input) {
    this.calls++;
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
const logs = [];
const deps = (userId, over = {}) => ({ store: storeFor(userId), keys, now: () => clock, log: (line) => logs.push(line), ...over });

/* ------------------------------------------------------------------ the CLI side */
const askChallenge = (who, over = {}, d = deps(who.id)) =>
  challengeRequest(who.id, { check_id: CHECK.id, version: CHECK.version, sha256: CHECK.sha256, device_id: who.deviceId, ...over }, d);

function buildResult(who, challenge, over = {}) {
  const c = JSON.parse(challenge);
  return {
    v: 1, kind: "academy.check-result", check: c.check, challenge: { nonce: c.nonce, expires_at: c.expires_at },
    device_id: who.deviceId, user_id: who.id, commit: { sha: "a1b2c3d", clean: true }, checker_version: "0.1.0",
    started_at: clock + 1, finished_at: clock + 4, passed: true,
    results: { steps: [{ id: "class-list", kind: "files", title: "The class list is in reports/term-1", required: true, outcome: "pass", reasons: [] }] },
    ...over,
  };
}
/** A complete, honest submission by `who`. */
async function submission(who, over = {}) {
  const issued = await askChallenge(who);
  assert.equal(issued.status, 200, JSON.stringify(issued.body));
  const signed = signResult(buildResult(who, issued.body.challenge, over), who.privateSeed);
  return { challenge: issued.body.challenge, stamp: issued.body.stamp, payload: signed.payload, signature: signed.signature };
}
const submit = (who, body, d = deps(who.id)) => submitRequest(who.id, body, d);
const runCount = async () => (await rows(db, "select count(*)::int n from public.check_runs"))[0].n;
/** Refused, and nothing was written. */
async function refused(answer, status, error) {
  const before = await runCount();
  const out = await answer;
  assert.equal(out.status, status, JSON.stringify(out.body));
  assert.equal(out.body.error, error);
  assert.equal(await runCount(), before, "no row was written");
  return out;
}

const { test, done } = runner("Check-run security");

/* ------------------------------------------------------------------ the honest path */
await test("an honest result is recorded once, as the learner, with the signed values", async () => {
  const body = await submission(A);
  const out = await submit(A, body);
  assert.equal(out.status, 201, JSON.stringify(out.body));
  assert.equal(out.body.passed, true);
  const [run] = await rows(db, "select * from public.check_runs where id = $1", [out.body.run_id]);
  const signed = JSON.parse(body.payload);
  assert.equal(run.user_id, A.id);
  assert.equal(run.device_id, A.deviceId);
  assert.equal(run.nonce, signed.challenge.nonce);
  assert.equal(run.signature, body.signature);
  assert.deepEqual([run.passed, run.commit_sha, run.tree_clean, run.checker_version], [true, "a1b2c3d", true, "0.1.0"]);
  assert.deepEqual(run.results, signed.results);
  assert.equal(Math.floor(new Date(run.started_at).getTime() / 1000), signed.started_at);
  assert.equal(Math.floor(new Date(run.finished_at).getTime() / 1000), signed.finished_at);
  // The learner sees it; another learner does not.
  assert.equal((await as(db, A.id, () => rows(db, "select id from public.check_runs"))).length, 1);
  assert.equal((await as(db, B.id, () => rows(db, "select id from public.check_runs"))).length, 0);
});

await test("a failed check is recorded as not passed; a result with no commit is accepted", async () => {
  const steps = [{ id: "tests", kind: "tests", title: "Tests", required: true, outcome: "fail", reasons: ["7 of 9 passed"] }];
  const out = await submit(A, await submission(A, { passed: false, results: { steps }, commit: { sha: null, clean: null } }));
  assert.equal(out.status, 201);
  const [run] = await rows(db, "select passed, commit_sha, tree_clean from public.check_runs where id = $1", [out.body.run_id]);
  assert.deepEqual(run, { passed: false, commit_sha: null, tree_clean: null });
});

/* ------------------------------------------- "What this stops" (docs/checker.md) */
await test("editing a result on the way is refused (payload, signature, challenge or stamp changed)", async () => {
  const body = await submission(A, { passed: false, results: { steps: [{ id: "tests", kind: "tests", title: "Tests", required: true, outcome: "fail", reasons: ["no"] }] } });
  await refused(submit(A, { ...body, payload: body.payload.replace('"passed":false', '"passed":true') }), 403, "refused");
  await refused(submit(A, { ...body, payload: body.payload.replace('"outcome":"fail"', '"outcome":"pass"') }), 403, "refused");
  const flip = (text, at) => text.slice(0, at) + (text[at] === "A" ? "B" : "A") + text.slice(at + 1);
  await refused(submit(A, { ...body, signature: flip(body.signature, 20) }), 403, "refused");
  await refused(submit(A, { ...body, stamp: flip(body.stamp, 5) }), 403, "refused");
  await refused(submit(A, { ...body, challenge: body.challenge.replace('"issued_at":1794000000', '"issued_at":1794000001') }), 403, "refused");
  // The untouched submission is still good: the refusals above burnt nothing.
  assert.equal((await submit(A, body)).status, 201);
});

await test("typing a pass into the database is refused (no direct insert; see also test-immutable-history)", async () => {
  await as(db, A.id, () => expectRefused(db,
    `insert into public.check_runs (user_id, device_id, definition_id, nonce, passed, results, signature, checker_version)
     values ($1, $2, 1, 'typed-in-0123456789abcdef', true, '{"steps":[]}', $3, '0.1.0')`, [A.id, A.deviceId, "s".repeat(88)], /permission denied/));
});

await test("sending the same passing result twice records it once (replayed nonce)", async () => {
  const body = await submission(A);
  assert.equal((await submit(A, body)).status, 201);
  await refused(submit(A, body), 409, "already_recorded");
  await refused(submit(A, body), 409, "already_recorded");
  const nonce = JSON.parse(body.payload).challenge.nonce;
  assert.equal((await rows(db, "select count(*)::int n from public.check_runs where nonce = $1", [nonce]))[0].n, 1);
});

await test("a passing result cannot be used for another project or version", async () => {
  // The device signs a result for m1-p2 against a challenge issued for m1-p1.
  const issued = await askChallenge(A);
  const forOther = signResult(buildResult(A, issued.body.challenge, { check: { ...CHECK, id: "m1-p2" } }), A.privateSeed);
  await refused(submit(A, { challenge: issued.body.challenge, stamp: issued.body.stamp, ...forOther }), 403, "refused");
  // A home-made challenge for m1-p2 (the learner does not hold the challenge key).
  const forged = issueChallenge({ userId: A.id, deviceId: A.deviceId, check: { ...CHECK, id: "m1-p2" }, now: clock }, Buffer.alloc(32, 7));
  const signed = signResult(buildResult(A, forged.challenge), A.privateSeed);
  await refused(submit(A, { ...forged, ...signed }), 403, "refused");
  assert.ok(logs.includes("check-run refused: mismatch_check") && logs.includes("check-run refused: challenge_stamp"), "the exact reason is in the server log only");
});

await test("sending a result as another learner is refused", async () => {
  const body = await submission(A);
  // B replays A's whole submission with B's own sign-in: A's device is not B's.
  await refused(submit(B, body), 403, "device");
  // B asks for a challenge naming A's device.
  await refused(askChallenge(B, { device_id: A.deviceId }), 403, "device");
  // B signs with B's key but claims to be A, inside B's own challenge.
  const issued = await askChallenge(B);
  const asA = signResult(buildResult(B, issued.body.challenge, { user_id: A.id }), B.privateSeed);
  await refused(submit(B, { challenge: issued.body.challenge, stamp: issued.body.stamp, ...asA }), 403, "refused");
  // A's challenge, answered with a signature from B's device key.
  const mine = await askChallenge(A);
  const byB = signResult(buildResult(A, mine.body.challenge), B.privateSeed);
  await refused(submit(A, { challenge: mine.body.challenge, stamp: mine.body.stamp, ...byB }), 403, "refused");
  assert.equal((await submit(A, body)).status, 201, "A's own submission is still good");
});

await test("a revoked device is refused: no challenge, and a result signed before the revoke is not recorded", async () => {
  const C = await learner("c@example.test");
  const body = await submission(C);
  await as(db, C.id, () => db.query("update public.devices set revoked_at = now() where id = $1", [C.deviceId]));
  await refused(submit(C, body), 403, "device");
  await refused(askChallenge(C), 403, "device");
  // Even with a correct record stamp, the database refuses a revoked device.
  const nonce = JSON.parse(body.payload).challenge.nonce;
  const stamp = recordStamp({ userId: C.id, deviceId: C.deviceId, definitionId: 1, nonce, payloadSha256: sha256Hex(body.payload) }, keys.recordKey);
  await as(db, C.id, () => expectRefused(db, "select public.record_check_run($1, 1, $2, $3, $4, $5)", [C.deviceId, nonce, body.payload, body.signature, stamp], /not a valid device/));
});

await test("an old, changed or unpublished check is refused", async () => {
  await refused(askChallenge(A, { version: "9.9.9" }), 404, "unknown_check");
  await refused(askChallenge(A, { check_id: "m9-p9" }), 404, "unknown_check");
  await refused(askChallenge(A, { sha256: "cd".repeat(32) }), 409, "check_changed");
  // A submission for a version that was never published.
  const forged = issueChallenge({ userId: A.id, deviceId: A.deviceId, check: { ...CHECK, version: "9.9.9" }, now: clock }, keys.challengeKey);
  await refused(submit(A, { ...forged, ...signResult(buildResult(A, forged.challenge), A.privateSeed) }), 404, "unknown_check");
  // A newer version is published: the old one gets no new challenge.
  await db.exec("begin");
  try {
    await db.exec(`insert into public.check_definitions (item_slug, version, sha256) values ('m1-p1', '1.1.0', '${"cd".repeat(32)}')`);
    await refused(askChallenge(A), 409, "outdated_check");
    assert.equal((await askChallenge(A, { version: "1.1.0", sha256: "cd".repeat(32) })).status, 200);
  } finally {
    await db.exec("rollback");
  }
});

await test("an expired challenge is refused; one second earlier it is accepted", async () => {
  const start = clock;
  const late = await submission(A);
  const onTime = await submission(A);
  clock = start + 900;
  assert.equal((await submit(A, onTime)).status, 201);
  clock = start + 901;
  await refused(submit(A, late), 409, "challenge_expired");
  clock = start;
});

/* ------------------------------------------ the database door without the route */
await test("record_check_run() called directly, without the route's stamp, is refused", async () => {
  const body = await submission(A);
  const payload = JSON.parse(body.payload);
  const nonce = payload.challenge.nonce;
  const call = (who, stamp, over = {}) => {
    const a = { device: A.deviceId, definition: 1, nonce, payload: body.payload, signature: body.signature, ...over };
    return as(db, who, () => db.query("select public.record_check_run($1, $2, $3, $4, $5, $6)", [a.device, a.definition, a.nonce, a.payload, a.signature, stamp]));
  };
  const good = recordStamp({ userId: A.id, deviceId: A.deviceId, definitionId: 1, nonce, payloadSha256: sha256Hex(body.payload) }, keys.recordKey);
  const before = await runCount();
  const notFromRoute = /not sent by the platform/;
  // No stamp, a made-up stamp, the challenge stamp, and a stamp made with the challenge key.
  for (const stamp of ["", "0".repeat(64), body.stamp, recordStamp({ userId: A.id, deviceId: A.deviceId, definitionId: 1, nonce, payloadSha256: sha256Hex(body.payload) }, keys.challengeKey)])
    await assert.rejects(call(A.id, stamp), notFromRoute);
  // A real stamp, but for other arguments: another payload, nonce, definition, or learner.
  const passing = body.payload.replace('"checker_version":"0.1.0"', '"checker_version":"9.9.9"');
  await assert.rejects(call(A.id, good, { payload: passing }), notFromRoute);
  await assert.rejects(call(A.id, good, { nonce: nonce + "x" }), notFromRoute);
  await assert.rejects(call(A.id, good, { definition: 2 }), notFromRoute);
  await assert.rejects(call(B.id, good), notFromRoute);
  // Signed-out callers and the service role cannot run it at all.
  await assert.rejects(call("anon", good), /permission denied/);
  await assert.rejects(call("service", good), /permission denied/);
  await actAs(db, null);
  assert.equal(await runCount(), before);
  // With the route's stamp it is accepted once; again is a replay (unique nonce).
  await call(A.id, good);
  await actAs(db, null);
  await assert.rejects(call(A.id, good), (error) => error.code === "23505");
  await actAs(db, null);
  assert.equal(await runCount(), before + 1);
});

await test("even with a correct stamp, the function re-checks what it is given", async () => {
  const body = await submission(A);
  const payload = JSON.parse(body.payload);
  const stampFor = (o) => recordStamp({ userId: A.id, deviceId: o.device, definitionId: o.definition, nonce: o.nonce, payloadSha256: sha256Hex(body.payload) }, keys.recordKey);
  const call = (o) => as(db, A.id, () => db.query("select public.record_check_run($1, $2, $3, $4, $5, $6)", [o.device, o.definition, o.nonce, body.payload, body.signature, stampFor(o)]));
  const ok = { device: A.deviceId, definition: 1, nonce: payload.challenge.nonce };
  const before = await runCount();
  await assert.rejects(call({ ...ok, nonce: "another-nonce-0123456789" }), /does not match the arguments/);
  await assert.rejects(call({ ...ok, device: B.deviceId }), /does not match the arguments/);
  await assert.rejects(call({ ...ok, definition: 2 }), /not a published check version/);
  await assert.rejects(call({ ...ok, definition: 999 }), /not a published check version/);
  await actAs(db, null);
  assert.equal(await runCount(), before);
});

await test("the record key: unreadable by every API role, required, and at least 32 bytes", async () => {
  for (const who of [A.id, "anon", "service"]) {
    await as(db, who, () => expectRefused(db, "select * from private.server_keys", [], /permission denied/));
    await as(db, who, () => expectRefused(db, "insert into private.server_keys (name, key) values ('record', $1)", [Buffer.alloc(32, 1)], /permission denied/));
  }
  const [t] = await rows(db, "select relrowsecurity rls from pg_class where oid = 'private.server_keys'::regclass");
  assert.equal(t.rls, true);
  await expectRefused(db, "update private.server_keys set key = $1", [Buffer.alloc(16, 1)], /check constraint/);
  const body = await submission(A);
  await db.exec("delete from private.server_keys");
  try {
    await refused(submit(A, body), 500, "failed"); // without the key in the database nothing is recorded
  } finally {
    await actAs(db, null);
    await db.query("insert into private.server_keys (name, key) values ('record', $1)", [keys.recordKey]);
  }
  // A route whose record key differs from the database's cannot record either.
  await refused(submit(A, body, deps(A.id, { keys: { ...keys, recordKey: Buffer.alloc(32, 9) } })), 403, "refused");
  assert.equal((await submit(A, body)).status, 201);
});

/* ------------------------------------------------------------------ the routes */
await test("no Bearer token, an expired token and a cookie-only request each get 401, before anything else", async () => {
  // The same rule as bearer.ts: the learner comes only from "Authorization: Bearer"; cookies are never read.
  const tokens = new Map([["valid-token-0123456789abcdef", A.id]]);
  const learnerOf = async (request) => {
    const token = bearerToken(request.headers.get("authorization"));
    return token && tokens.has(token) ? { userId: tokens.get(token) } : null;
  };
  const unauthorized = () => Response.json({ error: "sign_in" }, { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
  let touched = 0;
  const body = await submission(A);
  const routes = {
    "/api/check-runs/challenge": { maxBody: MAX_CHALLENGE_BODY, body: { check_id: CHECK.id, version: CHECK.version, sha256: CHECK.sha256, device_id: A.deviceId },
      handle: (l, b) => { touched++; return challengeRequest(l.userId, b, deps(l.userId)); }, ok: 200 },
    "/api/check-runs": { maxBody: MAX_SUBMISSION_BODY, body, handle: (l, b) => { touched++; return submitRequest(l.userId, b, deps(l.userId)); }, ok: 201 },
  };
  for (const [path, route] of Object.entries(routes)) {
    const call = (headers) => cliRoute(new Request(`https://academy.test${path}`, { method: "POST", headers, body: JSON.stringify(route.body) }),
      { learnerOf, unauthorized, maxBody: route.maxBody }, route.handle);
    const before = await runCount();
    for (const [name, headers] of Object.entries({
      "no Bearer token": {},
      "an expired token": { authorization: "Bearer expired-token-0123456789abcdef" },
      "a cookie only": { cookie: "sb-access-token=valid-token-0123456789abcdef; sb-refresh-token=x" },
      "a cookie and a bad header": { cookie: "sb-access-token=valid-token-0123456789abcdef", authorization: "Basic dXNlcjpwYXNz" },
      "a lowercase scheme": { authorization: "bearer valid-token-0123456789abcdef" },
    })) {
      const response = await call(headers);
      assert.equal(response.status, 401, `${path}: ${name}`);
      assert.equal((await response.json()).error, "sign_in");
    }
    assert.equal(touched, 0, `${path}: nothing ran for an unknown caller`);
    assert.equal(await runCount(), before);
    const good = await call({ authorization: "Bearer valid-token-0123456789abcdef" });
    assert.equal(good.status, route.ok, `${path}: a signed-in CLI is served`);
    assert.equal(good.headers.get("cache-control"), "no-store");
    touched = 0;
    // Too large, and not JSON.
    const big = await cliRoute(new Request(`https://academy.test${path}`, { method: "POST", headers: { authorization: "Bearer valid-token-0123456789abcdef" }, body: "x".repeat(route.maxBody + 1) }),
      { learnerOf, unauthorized, maxBody: route.maxBody }, route.handle);
    assert.equal(big.status, 413);
    const notJson = await cliRoute(new Request(`https://academy.test${path}`, { method: "POST", headers: { authorization: "Bearer valid-token-0123456789abcdef" }, body: "{" }),
      { learnerOf, unauthorized, maxBody: route.maxBody }, route.handle);
    assert.equal(notJson.status, 400);
    assert.equal(touched, 0);
  }
});

await test("the route files: Bearer helper first, Node runtime, no cookies, and the proxy lets them through", async () => {
  for (const file of ["apps/web/src/app/api/check-runs/route.ts", "apps/web/src/app/api/check-runs/challenge/route.ts"]) {
    const source = read(file);
    assert.match(source, /learnerOf: bearerLearner, unauthorized: signInAgain/, file);
    assert.match(source, /export const runtime = "nodejs"/, file);
    assert.doesNotMatch(source, /cookies\(|next\/headers|lib\/supabase\/server|getSession/, `${file}: never reads a cookie session`);
    assert.doesNotMatch(source, /export async function (GET|PUT|PATCH|DELETE)/, `${file}: POST only`);
  }
  const { decideGate, isCliApiPath } = await import("../apps/web/src/lib/auth/gate.ts");
  for (const path of ["/api/check-runs", "/api/check-runs/challenge"]) {
    assert.equal(isCliApiPath(path), true);
    assert.deepEqual(decideGate(path, false), { kind: "next", private: true }, "no redirect to the sign-in page: the route answers 401 itself");
  }
});

await test("missing server keys: the routes answer 503 and touch nothing", async () => {
  const d = deps(A.id, { keys: null });
  assert.equal((await challengeRequest(A.id, { check_id: CHECK.id, version: CHECK.version, sha256: CHECK.sha256, device_id: A.deviceId }, d)).status, 503);
  assert.equal((await submitRequest(A.id, await submission(A), d)).status, 503);
  assert.equal(d.store.calls, 0);
  const store = read("apps/web/src/lib/check-runs/store.ts");
  assert.match(store, /^import "server-only";/);
  assert.match(store, /process\.env\.ACADEMY_CHALLENGE_KEY/);
  assert.match(store, /process\.env\.ACADEMY_RECORD_KEY/);
  const example = read(".env.example");
  assert.match(example, /^ACADEMY_CHALLENGE_KEY=$/m);
  assert.match(example, /^ACADEMY_RECORD_KEY=$/m);
  assert.doesNotMatch(example + store, /NEXT_PUBLIC_ACADEMY/);
});

await test("bad requests are refused before any look-up or with a plain answer", async () => {
  const d = deps(A.id);
  for (const body of [null, [], {}, { check_id: "m1-p1" }, { check_id: "M1 P1", version: "1.0.0", sha256: HASH, device_id: A.deviceId },
    { check_id: "m1-p1", version: "1", sha256: HASH, device_id: A.deviceId }, { check_id: "m1-p1", version: "1.0.0", sha256: "x", device_id: A.deviceId },
    { check_id: "m1-p1", version: "1.0.0", sha256: HASH, device_id: "not-a-uuid" }])
    assert.equal((await challengeRequest(A.id, body, d)).status, 400);
  const good = await submission(A);
  for (const body of [null, {}, { ...good, extra: "x" }, { ...good, payload: 5 }, { ...good, challenge: "{" }, { ...good, challenge: '{"device_id":"x"}' }, { ...good, payload: "x".repeat(200001) }])
    assert.equal((await submitRequest(A.id, body, d)).status, 400);
  assert.equal(d.store.calls, 0, "nothing was looked up");
  // Non-canonical or schema-breaking payloads signed by the right device: a plain 400.
  const issued = await askChallenge(A);
  const { sign, createPrivateKey } = await import("node:crypto");
  const key = createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(A.privateSeed, "base64url")]), format: "der", type: "pkcs8" });
  const spaced = JSON.stringify(buildResult(A, issued.body.challenge), null, 1);
  const signature = sign(null, Buffer.from("ruftech-academy/check-result/v1\n" + spaced, "utf8"), key).toString("base64url");
  await refused(submit(A, { challenge: issued.body.challenge, stamp: issued.body.stamp, payload: spaced, signature }), 400, "bad_request");
});

await test("after every refusal above, history holds only honest rows and none was changed", async () => {
  const all = await rows(db, "select user_id, device_id, definition_id, passed, signature from public.check_runs order by id");
  assert.ok(all.length >= 8);
  for (const run of all) {
    assert.ok([A.id, B.id].includes(run.user_id));
    assert.equal(run.device_id, run.user_id === A.id ? A.deviceId : B.deviceId);
    assert.equal(run.signature.length, 86);
  }
  assert.equal(new Set((await rows(db, "select nonce from public.check_runs")).map((r) => r.nonce)).size, all.length, "one row per nonce");
  await expectRefused(db, "update public.check_runs set passed = true", [], /history rows cannot be changed/);
});

await db.close();
done();
