/**
 * T12: the wire format shared by the CLI and the platform (docs/protocol.md).
 * Fixed vectors verify both ways, and every attack the protocol must stop fails
 * for the stated reason. Offline: node:crypto and an in-memory database only.
 */
import assert from "node:assert/strict";
import { createPrivateKey, createPublicKey, sign, verify as nodeVerify } from "node:crypto";
import { readFileSync } from "node:fs";
import { CanonicalError, canonicalize, canonicalBytes, parseCanonical } from "../packages/shared/src/canonical.ts";
import { LIMITS, passedFromSteps, validateChallenge, validateResult } from "../packages/shared/src/result-schema.ts";
import {
  RESULT_CONTEXT, fromBase64Url, generateDeviceKeyPair, isDevicePublicKey, issueChallenge, recordStamp, sha256Hex,
  signResult, verifyChallenge, verifyResultSignature, verifySubmission,
} from "../packages/shared/src/signing.ts";
import { expectRefused, freshDatabase, runner } from "./lib/pglite-schema.mjs";
import { CHECK_RUN_INSERT, seed } from "./lib/schema-fixtures.mjs";

/* ------------------------------------------------ fixed vectors (protocol.md §9) */
const seq = (from) => Uint8Array.from({ length: 32 }, (_, i) => from + i);
const V = {
  seedA: seq(1), // bytes 01 02 … 20
  seedB: seq(33), // bytes 21 22 … 40
  publicA: "ed25519:ebVWLo_mVPlAeLES6KmLp5AfhTrmlb7X4OORC60ElmQ",
  publicB: "ed25519:5_FioQvsVZr-oZXk3OhLaVaNXSywlj60RsBoXisX8vA",
  challengeKey: Buffer.alloc(32, 0xc1),
  recordKey: Buffer.alloc(32, 0xd2),
  userId: "11111111-1111-4111-8111-111111111111",
  deviceId: "22222222-2222-4222-8222-222222222222",
  otherDeviceId: "33333333-3333-4333-8333-333333333333",
  check: { id: "m1-p1", version: "1.0.0", sha256: "ab".repeat(32) },
  now: 1794000000,
  nonce: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYX",
  challenge: '{"check":{"id":"m1-p1","sha256":"abababababababababababababababababababababababababababababababab","version":"1.0.0"},"device_id":"22222222-2222-4222-8222-222222222222","expires_at":1794000900,"issued_at":1794000000,"kind":"academy.challenge","nonce":"AAECAwQFBgcICQoLDA0ODxAREhMUFRYX","user_id":"11111111-1111-4111-8111-111111111111","v":1}',
  stamp: "L7_FGNlaqj_2nHslUWTAjjqap2RRgaRWUP3a0fShNrE",
  payload: '{"challenge":{"expires_at":1794000900,"nonce":"AAECAwQFBgcICQoLDA0ODxAREhMUFRYX"},"check":{"id":"m1-p1","sha256":"abababababababababababababababababababababababababababababababab","version":"1.0.0"},"checker_version":"0.1.0","commit":{"clean":true,"sha":"a1b2c3d"},"device_id":"22222222-2222-4222-8222-222222222222","finished_at":1794000009,"kind":"academy.check-result","passed":false,"results":{"steps":[{"id":"class-list","kind":"files","outcome":"pass","reasons":[],"required":true,"title":"The class list is in reports/term-1"},{"id":"backup-runs","kind":"tests","outcome":"fail","reasons":["Running ./scripts/backup.sh did not print exactly \'backup ok\'."],"required":true,"title":"backup.sh prints \\"backup ok\\""},{"id":"answers","kind":"doc","outcome":"pass","reasons":[],"required":true,"title":"answers.md has the three headings — é"}]},"started_at":1794000005,"user_id":"11111111-1111-4111-8111-111111111111","v":1}',
  payloadBytes: 928,
  payloadSha256: "0569d3458c317e448258bfebcdb0e87832c9cd41dd56932fd936b8dec268728a",
  signature: "wyffKLd7hcv4ht6k0Zkd9xbo9uTRRD_9sNfu8fbxvXKVy3J_IAUzh13fBTWHfUjDUPtHitR1dBDvLFeSmHLcAA",
  recordStamp: "602824d1042ff9dabf6aee743baa50de9eecebc08107dff4ea83ec7fba6dd37e",
};
/** The result as the CLI builds it, with keys in a non-canonical order on purpose. */
const result = () => ({
  v: 1, kind: "academy.check-result", check: { ...V.check },
  challenge: { nonce: V.nonce, expires_at: V.now + 900 },
  device_id: V.deviceId, user_id: V.userId, commit: { sha: "a1b2c3d", clean: true },
  checker_version: "0.1.0", started_at: V.now + 5, finished_at: V.now + 9, passed: false,
  results: { steps: [
    { id: "class-list", kind: "files", title: "The class list is in reports/term-1", required: true, outcome: "pass", reasons: [] },
    { id: "backup-runs", kind: "tests", title: 'backup.sh prints "backup ok"', required: true, outcome: "fail", reasons: ["Running ./scripts/backup.sh did not print exactly 'backup ok'."] },
    { id: "answers", kind: "doc", title: "answers.md has the three headings — é", required: true, outcome: "pass", reasons: [] },
  ] },
});
const A = generateDeviceKeyPair(V.seedA);
const B = generateDeviceKeyPair(V.seedB);
const submission = () => ({ challenge: V.challenge, stamp: V.stamp, payload: V.payload, signature: V.signature });
const context = (over = {}) => ({ challengeKey: V.challengeKey, publicKey: V.publicA, now: V.now + 10,
  expected: { userId: V.userId, deviceId: V.deviceId, check: V.check }, ...over });
const refusal = (sub, ctx, code) => {
  const out = verifySubmission(sub, ctx);
  assert.equal(out.ok, false, `expected ${code}, but it was accepted`);
  assert.equal(out.code, code);
};

const { test, done } = runner("Protocol vectors");

/* ------------------------------------------------------------- canonical JSON */
await test("canonical JSON: sorted keys, no whitespace, integers, UTF-8", () => {
  assert.equal(canonicalize({ b: 1, a: [true, null, "x"], "": 0, A: -7 }), '{"":0,"A":-7,"a":[true,null,"x"],"b":1}');
  assert.equal(canonicalize({ "é": 1, z: 2, "€": 3, "😀": 4 }), '{"z":2,"é":1,"€":3,"😀":4}');
  assert.equal(canonicalize('line\nbreak "q" \\ \u0001'), '"line\\nbreak \\"q\\" \\\\ \\u0001"');
  assert.deepEqual([...canonicalBytes({ k: "é" })], [0x7b, 0x22, 0x6b, 0x22, 0x3a, 0x22, 0xc3, 0xa9, 0x22, 0x7d]);
  assert.equal(canonicalize(result()), V.payload, "the vector's canonical text");
  assert.equal(Buffer.byteLength(V.payload), V.payloadBytes);
});

await test("canonical JSON refuses NaN, Infinity, fractions, -0, undefined, and non-plain values", () => {
  const sparse = [1, 2, 3]; delete sparse[1];
  const loop = {}; loop.self = loop;
  for (const [name, value] of Object.entries({
    NaN: NaN, Infinity: Infinity, fraction: 1.5, big: 2 ** 53, minusZero: -0, undefined: undefined,
    undefinedField: { a: undefined }, undefinedItem: [undefined], bigint: 1n, fn: () => 1, symbol: Symbol("s"),
    date: new Date(0), map: new Map(), sparse, loop, loneSurrogate: "\ud800", loneSurrogateKey: { "\udc00": 1 },
  })) assert.throws(() => canonicalize(value), CanonicalError, name);
});

await test("parseCanonical accepts only the one canonical form (no duplicate keys, order, whitespace, number forms)", () => {
  assert.deepEqual(parseCanonical('{"a":1,"b":[2,"x"]}'), { a: 1, b: [2, "x"] });
  for (const [name, text] of Object.entries({
    duplicateKey: '{"a":1,"a":2}', reordered: '{"b":1,"a":2}', space: '{"a": 1}', newline: '{"a":1}\n', leadingSpace: ' {"a":1}',
    fraction: '{"a":1.0}', exponent: '{"a":1e2}', minusZero: '{"a":-0}', escapedSlash: '{"a":"\\/"}', unicodeEscape: '{"a":"\\u0041"}',
    notJson: "{a:1}", empty: "",
  })) assert.throws(() => parseCanonical(text), CanonicalError, name);
});

/* ---------------------------------------------------------------- the vectors */
await test("keys: a 32-byte seed gives the fixed public key (and RFC 8032 test 1 matches)", () => {
  assert.equal(A.publicKey, V.publicA);
  assert.equal(B.publicKey, V.publicB);
  assert.equal(A.publicKey.length, 51);
  const rfc = generateDeviceKeyPair(Buffer.from("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60", "hex"));
  assert.equal(fromBase64Url(rfc.publicKey.slice(8)).toString("hex"), "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a");
  assert.equal(isDevicePublicKey(V.publicA), true);
  for (const bad of ["", "ed25519:", "ed25519:AAAA", V.publicA.slice(8), "rsa:" + V.publicA.slice(8), V.publicA + "=", V.publicA + "A"]) assert.equal(isDevicePublicKey(bad), false, bad);
});

await test("CLI side: signing the result gives exactly the fixed payload and signature", () => {
  const signed = signResult(result(), A.privateSeed);
  assert.equal(signed.payload, V.payload);
  assert.equal(signed.signature, V.signature);
  assert.equal(signed.signature.length, 86);
  assert.equal(sha256Hex(signed.payload), V.payloadSha256);
});

await test("platform side: the fixed vector verifies, also with a second, independent key import", () => {
  assert.equal(verifyResultSignature(V.payload, V.signature, V.publicA), true);
  // Independent path: import the same public key as a JWK and verify the stated bytes.
  const jwk = createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: V.publicA.slice(8) }, format: "jwk" });
  assert.equal(nodeVerify(null, Buffer.from(RESULT_CONTEXT + V.payload, "utf8"), jwk, Buffer.from(V.signature, "base64url")), true);
  // The context line is part of what is signed: the bare payload does not verify.
  assert.equal(nodeVerify(null, Buffer.from(V.payload, "utf8"), jwk, Buffer.from(V.signature, "base64url")), false);
});

await test("challenge and stamps: the platform issues the fixed challenge, stamp and record stamp", () => {
  const issued = issueChallenge({ userId: V.userId, deviceId: V.deviceId, check: V.check, now: V.now, nonce: V.nonce }, V.challengeKey);
  assert.deepEqual(issued, { challenge: V.challenge, stamp: V.stamp });
  assert.equal(verifyChallenge(V.challenge, V.stamp, V.challengeKey, V.now + 10).ok, true);
  assert.equal(recordStamp({ userId: V.userId, deviceId: V.deviceId, definitionId: 7, nonce: V.nonce, payloadSha256: V.payloadSha256 }, V.recordKey), V.recordStamp);
  const random = issueChallenge({ userId: V.userId, deviceId: V.deviceId, check: V.check, now: V.now }, V.challengeKey);
  const nonce = JSON.parse(random.challenge).nonce;
  assert.match(nonce, /^[A-Za-z0-9_-]{32}$/, "a real nonce is 24 random bytes");
  assert.notEqual(nonce, V.nonce);
});

await test("the whole submission verifies and returns what T19 records", () => {
  const out = verifySubmission(submission(), context());
  assert.equal(out.ok, true);
  assert.equal(out.payloadSha256, V.payloadSha256);
  assert.deepEqual(out.result, parseCanonical(V.payload));
  assert.equal(out.challenge.nonce, V.nonce);
  assert.equal(out.result.passed, false);
});

/* ------------------------------------------------------- what must be refused */
await test("a changed byte in the payload fails (every position is covered by the signature)", () => {
  for (const at of [1, 40, 300, 600, V.payload.length - 2]) {
    const flipped = V.payload.slice(0, at) + (V.payload[at] === "a" ? "b" : "a") + V.payload.slice(at + 1);
    assert.equal(verifyResultSignature(flipped, V.signature, V.publicA), false, `position ${at}`);
  }
  refusal({ ...submission(), payload: V.payload.replace('"passed":false', '"passed":true') }, context(), "signature");
  // A changed byte in the signature, and signatures that are not 64 bytes in strict base64url.
  const sig = V.signature.slice(0, 10) + (V.signature[10] === "A" ? "B" : "A") + V.signature.slice(11);
  refusal({ ...submission(), signature: sig }, context(), "signature");
  for (const bad of ["", "AAAA", V.signature + "A", V.signature + "=", V.signature.replace(/_/g, "/")]) refusal({ ...submission(), signature: bad }, context(), "signature");
});

await test("a reordered key that is not re-canonicalised fails, even when signed by the right device", async () => {
  // Same values, other key order: the bytes differ, so the fixed signature does not match.
  const reordered = JSON.stringify(result());
  assert.notEqual(reordered, V.payload);
  assert.deepEqual(JSON.parse(reordered), JSON.parse(V.payload));
  refusal({ ...submission(), payload: reordered }, context(), "signature");
  // A device that signs non-canonical text itself is refused as malformed (same for whitespace and duplicate keys).
  const key = createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), V.seedA]), format: "der", type: "pkcs8" });
  const signedBy = (text) => sign(null, Buffer.from(RESULT_CONTEXT + text, "utf8"), key).toString("base64url");
  for (const text of [reordered, V.payload + " ", V.payload.replace('"v":1}', '"v":1,"v":1}')])
    refusal({ ...submission(), payload: text, signature: signedBy(text) }, context(), "payload_malformed");
});

await test("an expired challenge fails; so does one from the future or with a long life", () => {
  refusal(submission(), context({ now: V.now + 900 + 1 }), "challenge_expired");
  assert.equal(verifySubmission(submission(), context({ now: V.now + 900 })).ok, true, "valid up to and including the expiry second");
  refusal(submission(), context({ now: V.now - LIMITS.clockSkewSeconds - 1 }), "challenge_not_yet_valid");
  // A challenge that claims a longer life is not something the platform issues; forging one needs the key.
  const long = V.challenge.replace('"expires_at":1794000900', '"expires_at":1794999999');
  refusal({ ...submission(), challenge: long }, context(), "challenge_stamp");
  assert.equal(validateChallenge({ ...JSON.parse(V.challenge), expires_at: V.now + 901 }).ok, false);
});

await test("a challenge the platform did not issue fails: changed text, wrong key, wrong stamp", () => {
  refusal({ ...submission(), challenge: V.challenge.replace("m1-p1", "m1-p2") }, context(), "challenge_stamp");
  refusal(submission(), context({ challengeKey: Buffer.alloc(32, 0xee) }), "challenge_stamp");
  for (const bad of ["", "AAAA", V.stamp + "A", V.stamp.slice(0, -1) + (V.stamp.endsWith("E") ? "F" : "E")]) refusal({ ...submission(), stamp: bad }, context(), "challenge_stamp");
  assert.throws(() => issueChallenge({ userId: V.userId, deviceId: V.deviceId, check: V.check, now: V.now }, Buffer.alloc(16, 1)), /at least 32 bytes/);
  // The record key is a different key: its stamp is never accepted as a challenge stamp.
  const withRecordKey = issueChallenge({ userId: V.userId, deviceId: V.deviceId, check: V.check, now: V.now, nonce: V.nonce }, V.recordKey);
  refusal({ ...submission(), stamp: withRecordKey.stamp }, context(), "challenge_stamp");
});

await test("a result for another check or version fails", () => {
  // 1. A valid challenge for m1-p1 cannot record a run of another check, version or check content.
  for (const other of [{ ...V.check, id: "m1-p2" }, { ...V.check, version: "1.0.1" }, { ...V.check, sha256: "cd".repeat(32) }])
    refusal(submission(), context({ expected: { userId: V.userId, deviceId: V.deviceId, check: other } }), "expected_check");
  // 2. The device signs a result for another check but answers the m1-p1 challenge.
  for (const change of [{ id: "m1-p2" }, { version: "2.0.0" }, { sha256: "cd".repeat(32) }]) {
    const signed = signResult({ ...result(), check: { ...V.check, ...change } }, A.privateSeed);
    refusal({ ...submission(), ...signed }, context(), "mismatch_check");
  }
  // 3. A passing result signed for one challenge cannot answer another challenge (other nonce).
  const second = issueChallenge({ userId: V.userId, deviceId: V.deviceId, check: V.check, now: V.now, nonce: "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" }, V.challengeKey);
  refusal({ ...submission(), ...second }, context(), "mismatch_nonce");
});

await test("a signature from another device fails", () => {
  // Device B signs the same result: not the key stored for the device named in the challenge.
  const byB = signResult(result(), B.privateSeed);
  assert.notEqual(byB.signature, V.signature);
  refusal({ ...submission(), ...byB }, context(), "signature");
  assert.equal(verifyResultSignature(V.payload, V.signature, V.publicB), false);
  // B answers honestly as itself, but the challenge was issued to device A.
  const asB = signResult({ ...result(), device_id: V.otherDeviceId }, B.privateSeed);
  refusal({ ...submission(), ...asB }, context({ publicKey: V.publicB }), "mismatch_device");
  // The route looked up another device or another learner than the challenge names.
  refusal(submission(), context({ expected: { userId: V.userId, deviceId: V.otherDeviceId, check: V.check } }), "expected_device");
  refusal(submission(), context({ expected: { userId: V.otherDeviceId, deviceId: V.deviceId, check: V.check } }), "expected_user");
  const otherUser = signResult({ ...result(), user_id: V.otherDeviceId }, A.privateSeed);
  refusal({ ...submission(), ...otherUser }, context(), "mismatch_user");
  refusal(submission(), context({ publicKey: "ed25519:not-a-key" }), "signature");
});

await test("a reused challenge: the format cannot see it, so the database must (rule for T19)", async () => {
  // Without storage, the same valid submission verifies twice. This is by design.
  assert.equal(verifySubmission(submission(), context()).ok, true);
  assert.equal(verifySubmission(submission(), context()).ok, true);
  // The rule: check_runs.nonce is UNIQUE, so the second record of one nonce is refused.
  const db = await freshDatabase();
  const f = await seed(db);
  const args = [f.a.id, f.a.deviceId, f.definitionId, V.nonce];
  await db.query(CHECK_RUN_INSERT, args);
  await expectRefused(db, CHECK_RUN_INSERT, args, /unique|duplicate/);
  // The same nonce cannot be reused by another learner or device either.
  await expectRefused(db, CHECK_RUN_INSERT, [f.b.id, f.b.deviceId, f.definitionId, V.nonce], /unique|duplicate/);
  await db.close();
});

/* ------------------------------------------------------------ result schema */
await test("result schema: outcomes and short reasons only; unknown fields are refused", () => {
  assert.equal(validateResult(result()).ok, true);
  const bad = (change, pattern) => {
    const value = result(); change(value);
    const out = validateResult(value);
    assert.equal(out.ok, false, String(pattern));
    assert.match(out.errors.join("\n"), pattern);
  };
  bad((r) => { r.source = "console.log(1)"; }, /\$\.source: unknown field/);
  bad((r) => { r.results.steps[0].code = "x"; }, /steps\[0\]\.code: unknown field/);
  bad((r) => { r.results.steps[0].output = "x".repeat(10); }, /unknown field/);
  bad((r) => { r.results.steps[1].reasons = ["line one\nline two"]; }, /one line/);
  bad((r) => { r.results.steps[1].reasons = ["x".repeat(LIMITS.reasonChars + 1)]; }, /one line of 1–300/);
  bad((r) => { r.results.steps[1].reasons = Array(LIMITS.reasonsPerStep + 1).fill("r"); }, /at most 5 reasons/);
  bad((r) => { r.results.steps[0].kind = "shell"; }, /kind: must be one of/);
  bad((r) => { r.results.steps[0].outcome = "ok"; }, /outcome: must be one of/);
  bad((r) => { r.results.steps[1].id = "class-list"; }, /used twice/);
  bad((r) => { r.results.steps = []; }, /1–60 steps/);
  bad((r) => { r.passed = true; }, /does not match the steps/);
  bad((r) => { r.v = 2; }, /\$\.v/);
  bad((r) => { r.kind = "academy.challenge"; }, /\$\.kind/);
  bad((r) => { delete r.user_id; }, /user_id: missing/);
  bad((r) => { r.finished_at = r.started_at - 1; }, /before started_at/);
  bad((r) => { r.started_at = 1.5; }, /whole seconds/);
});

await test("result schema respects the check_runs limits (nonce, commit, size)", () => {
  const ok = (change) => { const value = result(); change(value); return validateResult(value).ok; };
  assert.equal(ok((r) => { r.challenge.nonce = "n".repeat(15); }), false);
  assert.equal(ok((r) => { r.challenge.nonce = "n".repeat(16); }), true);
  assert.equal(ok((r) => { r.challenge.nonce = "n".repeat(128); }), true);
  assert.equal(ok((r) => { r.challenge.nonce = "n".repeat(129); }), false);
  assert.equal(ok((r) => { r.challenge.nonce = "has space 0123456789"; }), false);
  assert.equal(ok((r) => { r.commit = { sha: "abc123", clean: true }; }), false);
  assert.equal(ok((r) => { r.commit = { sha: "a".repeat(64), clean: false }; }), true);
  assert.equal(ok((r) => { r.commit = { sha: "A1B2C3D", clean: true }; }), false);
  assert.equal(ok((r) => { r.commit = { sha: null, clean: null }; }), true);
  assert.equal(ok((r) => { r.commit = { sha: null, clean: true }; }), false);
  // The largest result the rules allow still fits the table (64 kB) with room to spare.
  const big = result();
  big.results.steps = Array.from({ length: LIMITS.steps }, (_, i) => ({ id: `s${i}`, kind: "tests", title: "t".repeat(LIMITS.titleChars), required: true, outcome: "fail", reasons: Array(LIMITS.reasonsPerStep).fill("é".repeat(LIMITS.reasonChars)) }));
  const out = validateResult(big);
  assert.equal(out.ok, false);
  assert.match(out.errors.join("\n"), /the limit is 32768/);
  big.results.steps = big.results.steps.slice(0, 9);
  assert.equal(validateResult(big).ok, true);
  assert.ok(canonicalBytes(big.results).length <= LIMITS.resultsBytes && LIMITS.resultsBytes < 65536);
  const sql = readFileSync(new URL("../supabase/migrations/0004_devices_check_runs.sql", import.meta.url), "utf8");
  for (const limit of ["pg_column_size(results) <= 65536", "char_length(signature) between 32 and 400", "'^[0-9a-f]{7,64}$'", "char_length(nonce) between 16 and 128"])
    assert.ok(sql.includes(limit), `the migration still states: ${limit}`);
  assert.ok(V.signature.length >= 32 && V.signature.length <= 400);
});

await test("passed is derived from the steps: every required step must pass", () => {
  const step = (required, outcome) => ({ required, outcome });
  assert.equal(passedFromSteps([step(true, "pass"), step(false, "fail")]), true);
  assert.equal(passedFromSteps([step(true, "pass"), step(true, "needs")]), false);
  assert.equal(passedFromSteps([step(true, "pass"), step(true, "skipped")]), false);
  assert.equal(passedFromSteps([step(false, "pass")]), false, "a check with no required step never passes");
});

await test("the record stamp binds learner, device, definition, nonce and payload", () => {
  const base = { userId: V.userId, deviceId: V.deviceId, definitionId: 7, nonce: V.nonce, payloadSha256: V.payloadSha256 };
  const stamp = (over, key = V.recordKey) => recordStamp({ ...base, ...over }, key);
  assert.match(stamp({}), /^[0-9a-f]{64}$/);
  for (const over of [{ userId: V.otherDeviceId }, { deviceId: V.otherDeviceId }, { definitionId: 8 }, { nonce: V.nonce + "x" }, { payloadSha256: "0".repeat(64) }])
    assert.notEqual(stamp(over), V.recordStamp, JSON.stringify(over));
  assert.notEqual(stamp({}, V.challengeKey), V.recordStamp);
  assert.equal(stamp({ definitionId: "7" }), V.recordStamp);
  assert.throws(() => stamp({ definitionId: 0 }), /positive whole number/);
  assert.throws(() => stamp({ nonce: "a\nb" }), /line break/);
});

await test("docs/protocol.md states the same vectors as this test", () => {
  const doc = readFileSync(new URL("../docs/protocol.md", import.meta.url), "utf8");
  for (const [name, value] of Object.entries({ publicA: V.publicA, publicB: V.publicB, stamp: V.stamp, signature: V.signature,
    payloadSha256: V.payloadSha256, recordStamp: V.recordStamp, challenge: V.challenge, payload: V.payload }))
    assert.ok(doc.includes(value), `protocol.md holds ${name}`);
});

done();
