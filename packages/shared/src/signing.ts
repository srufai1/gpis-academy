/**
 * Signing and verification (T12, docs/protocol.md §4–§7).
 * Uses node:crypto only, so it runs in the CLI and in Next.js server code
 * (Node runtime). Do not import this file from a Client Component or an Edge route.
 *
 * Three separate things, each with its own context line so one can never be
 * taken for another:
 *   1. the device signature  Ed25519 over  "ruftech-academy/check-result/v1\n" + payload
 *   2. the challenge stamp   HMAC-SHA256 over "ruftech-academy/challenge/v1\n" + challenge
 *   3. the record stamp      HMAC-SHA256 over "ruftech-academy/record/v1\n" + five lines
 */
import { createHash, createHmac, createPrivateKey, createPublicKey, randomBytes, sign, timingSafeEqual, verify, type KeyObject } from "node:crypto";
import { canonicalize, parseCanonical } from "./canonical.ts";
import { CHALLENGE_KIND, LIMITS, PROTOCOL_VERSION, validateChallenge, validateResult, type Challenge, type CheckRef, type CheckResult } from "./result-schema.ts";

export const RESULT_CONTEXT = "ruftech-academy/check-result/v1\n";
export const CHALLENGE_CONTEXT = "ruftech-academy/challenge/v1\n";
export const RECORD_CONTEXT = "ruftech-academy/record/v1\n";
export const PUBLIC_KEY_PREFIX = "ed25519:";
/** A server key must be at least this long (bytes). */
export const MIN_KEY_BYTES = 32;

const B64URL = /^[A-Za-z0-9_-]+$/;
// Fixed DER headers that wrap a raw 32-byte Ed25519 key (RFC 8410).
const SPKI_HEADER = Buffer.from("302a300506032b6570032100", "hex");
const PKCS8_HEADER = Buffer.from("302e020100300506032b657004220420", "hex");

export const toBase64Url = (bytes: Uint8Array): string => Buffer.from(bytes).toString("base64url");
/** Strict: only the URL-safe alphabet, no padding, and it must encode back to the same text. */
export function fromBase64Url(text: string): Buffer | null {
  if (typeof text !== "string" || !B64URL.test(text)) return null;
  const bytes = Buffer.from(text, "base64url");
  return bytes.toString("base64url") === text ? bytes : null;
}

/* ------------------------------------------------------------------ keys */

export type DeviceKeyPair = { publicKey: string; privateSeed: string };

/** A device key pair. `seed` (32 bytes) is for tests and vectors; leave it out for a real key. */
export function generateDeviceKeyPair(seed: Uint8Array = randomBytes(32)): DeviceKeyPair {
  if (seed.length !== 32) throw new Error("an Ed25519 seed is 32 bytes");
  const key = createPrivateKey({ key: Buffer.concat([PKCS8_HEADER, seed]), format: "der", type: "pkcs8" });
  const spki = createPublicKey(key).export({ format: "der", type: "spki" });
  return { publicKey: PUBLIC_KEY_PREFIX + toBase64Url(spki.subarray(SPKI_HEADER.length)), privateSeed: toBase64Url(seed) };
}

function privateKeyFrom(privateSeed: string): KeyObject {
  const seed = fromBase64Url(privateSeed);
  if (!seed || seed.length !== 32) throw new Error("the private seed must be 32 bytes in base64url");
  return createPrivateKey({ key: Buffer.concat([PKCS8_HEADER, seed]), format: "der", type: "pkcs8" });
}

/** The stored form "ed25519:<base64url of 32 bytes>" (51 characters), or null when it is anything else. */
function publicKeyFrom(publicKey: string): KeyObject | null {
  if (typeof publicKey !== "string" || !publicKey.startsWith(PUBLIC_KEY_PREFIX)) return null;
  const raw = fromBase64Url(publicKey.slice(PUBLIC_KEY_PREFIX.length));
  if (!raw || raw.length !== 32) return null;
  try {
    return createPublicKey({ key: Buffer.concat([SPKI_HEADER, raw]), format: "der", type: "spki" });
  } catch {
    return null;
  }
}

export const isDevicePublicKey = (publicKey: string): boolean => publicKeyFrom(publicKey) !== null;

/* ------------------------------------------------------- device signature */

const resultMessage = (payload: string): Buffer => Buffer.from(RESULT_CONTEXT + payload, "utf8");

/**
 * CLI side. Returns the two strings to send: the canonical payload and its
 * signature (base64url, 86 characters). Throws when the result is not valid.
 */
export function signResult(result: CheckResult, privateSeed: string): { payload: string; signature: string } {
  const checked = validateResult(result);
  if (!checked.ok) throw new Error(`the result is not valid: ${checked.errors.join("; ")}`);
  const payload = canonicalize(result);
  return { payload, signature: toBase64Url(sign(null, resultMessage(payload), privateKeyFrom(privateSeed))) };
}

/** True only when `signature` is this device's Ed25519 signature over exactly these payload characters. */
export function verifyResultSignature(payload: string, signature: string, publicKey: string): boolean {
  const key = publicKeyFrom(publicKey);
  const bytes = fromBase64Url(signature);
  if (!key || !bytes || bytes.length !== 64) return false;
  try {
    return verify(null, resultMessage(payload), key, bytes);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------- challenge stamp */

function hmac(key: Uint8Array, message: string): Buffer {
  if (key.length < MIN_KEY_BYTES) throw new Error(`a server key must be at least ${MIN_KEY_BYTES} bytes`);
  return createHmac("sha256", key).update(message, "utf8").digest();
}

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && timingSafeEqual(a, b);

/**
 * Platform side: issue a one-time challenge for (learner, device, check).
 * Nothing is stored; the stamp proves later that the platform issued it.
 * `nonce` is for tests and vectors; leave it out for a random one.
 */
export function issueChallenge(
  input: { userId: string; deviceId: string; check: CheckRef; now: number; nonce?: string },
  challengeKey: Uint8Array,
): { challenge: string; stamp: string } {
  const body: Challenge = {
    v: PROTOCOL_VERSION,
    kind: CHALLENGE_KIND,
    nonce: input.nonce ?? toBase64Url(randomBytes(24)),
    user_id: input.userId,
    device_id: input.deviceId,
    check: { id: input.check.id, version: input.check.version, sha256: input.check.sha256 },
    issued_at: input.now,
    expires_at: input.now + LIMITS.challengeSeconds,
  };
  const checked = validateChallenge(body);
  if (!checked.ok) throw new Error(`the challenge is not valid: ${checked.errors.join("; ")}`);
  const challenge = canonicalize(body);
  return { challenge, stamp: toBase64Url(hmac(challengeKey, CHALLENGE_CONTEXT + challenge)) };
}

export type Refusal = { ok: false; code: RefusalCode; message: string };
export type RefusalCode =
  | "challenge_malformed" | "challenge_stamp" | "challenge_expired" | "challenge_not_yet_valid"
  | "payload_malformed" | "payload_invalid" | "signature"
  | "mismatch_nonce" | "mismatch_expiry" | "mismatch_check" | "mismatch_device" | "mismatch_user"
  | "expected_user" | "expected_device" | "expected_check";

const refuse = (code: RefusalCode, message: string): Refusal => ({ ok: false, code, message });

/** Stamp first (is it ours?), then shape, then time. `now` is the server clock in whole seconds. */
export function verifyChallenge(challenge: string, stamp: string, challengeKey: Uint8Array, now: number): { ok: true; challenge: Challenge } | Refusal {
  if (typeof challenge !== "string" || challenge.length > 2000) return refuse("challenge_malformed", "The challenge is not readable.");
  const given = fromBase64Url(stamp);
  if (!given || !sameBytes(given, hmac(challengeKey, CHALLENGE_CONTEXT + challenge))) return refuse("challenge_stamp", "The challenge was not issued by this platform.");
  let parsed: unknown;
  try {
    parsed = parseCanonical(challenge);
  } catch {
    return refuse("challenge_malformed", "The challenge is not in canonical form.");
  }
  const checked = validateChallenge(parsed);
  if (!checked.ok) return refuse("challenge_malformed", checked.errors[0] ?? "The challenge is not valid.");
  if (now > checked.value.expires_at) return refuse("challenge_expired", "The challenge has expired. Run the check again.");
  if (checked.value.issued_at > now + LIMITS.clockSkewSeconds) return refuse("challenge_not_yet_valid", "The challenge is dated in the future.");
  return { ok: true, challenge: checked.value };
}

/* ------------------------------------------------------- whole submission */

/** What the CLI posts to the platform. Four strings; nothing else is trusted. */
export type Submission = { challenge: string; stamp: string; payload: string; signature: string };

export type Verified = { ok: true; result: CheckResult; challenge: Challenge; payloadSha256: string };

/**
 * Platform side: everything that can be checked WITHOUT the database, in a
 * fixed order. The caller (T19) supplies what it looked up:
 *   publicKey  the stored key of the device named in the challenge;
 *   expected   the signed-in learner, and the published check the run is for.
 * Reuse of a nonce cannot be seen here: the database's unique constraint
 * decides that (protocol.md §8).
 */
export function verifySubmission(
  submission: Submission,
  context: {
    challengeKey: Uint8Array;
    publicKey: string;
    now: number;
    expected: { userId: string; deviceId: string; check: CheckRef };
  },
): Verified | Refusal {
  const issued = verifyChallenge(submission.challenge, submission.stamp, context.challengeKey, context.now);
  if (!issued.ok) return issued;
  const challenge = issued.challenge;
  // The challenge is ours. Is it for this learner, this device and this published check?
  if (challenge.user_id !== context.expected.userId) return refuse("expected_user", "The challenge belongs to another learner.");
  if (challenge.device_id !== context.expected.deviceId) return refuse("expected_device", "The challenge belongs to another device.");
  const want = context.expected.check;
  if (challenge.check.id !== want.id || challenge.check.version !== want.version || challenge.check.sha256 !== want.sha256)
    return refuse("expected_check", "The challenge is for another check or version.");

  if (typeof submission.payload !== "string" || submission.payload.length > 200_000) return refuse("payload_malformed", "The result is not readable.");
  // Signature over the exact characters received, before anything is parsed out of them.
  if (!verifyResultSignature(submission.payload, submission.signature, context.publicKey)) return refuse("signature", "The signature does not match this device.");
  let parsed: unknown;
  try {
    parsed = parseCanonical(submission.payload);
  } catch {
    return refuse("payload_malformed", "The result is not in canonical form.");
  }
  const checked = validateResult(parsed);
  if (!checked.ok) return refuse("payload_invalid", checked.errors[0] ?? "The result is not valid.");
  const result = checked.value;
  // The signed result must name the same challenge, learner, device and check.
  if (result.challenge.nonce !== challenge.nonce) return refuse("mismatch_nonce", "The result answers another challenge.");
  if (result.challenge.expires_at !== challenge.expires_at) return refuse("mismatch_expiry", "The result carries another expiry.");
  if (result.user_id !== challenge.user_id) return refuse("mismatch_user", "The result names another learner.");
  if (result.device_id !== challenge.device_id) return refuse("mismatch_device", "The result names another device.");
  if (result.check.id !== challenge.check.id || result.check.version !== challenge.check.version || result.check.sha256 !== challenge.check.sha256)
    return refuse("mismatch_check", "The result is for another check or version.");
  return { ok: true, result, challenge, payloadSha256: sha256Hex(submission.payload) };
}

/* ----------------------------------------------------------- record stamp */

export const sha256Hex = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");

/**
 * The route's stamp for record_check_run() (T19): lowercase hex, so the
 * database can recompute it with pgcrypto and compare. It binds the learner,
 * the device, the check_definitions row, the nonce and the payload.
 */
export function recordStamp(
  input: { userId: string; deviceId: string; definitionId: number | string; nonce: string; payloadSha256: string },
  recordKey: Uint8Array,
): string {
  const definition = String(input.definitionId);
  if (!/^[1-9][0-9]*$/.test(definition)) throw new Error("definitionId must be a positive whole number");
  const lines = [input.userId, input.deviceId, definition, input.nonce, input.payloadSha256];
  if (lines.some((line) => line.includes("\n"))) throw new Error("a stamped field holds a line break");
  return hmac(recordKey, RECORD_CONTEXT + lines.join("\n")).toString("hex");
}
