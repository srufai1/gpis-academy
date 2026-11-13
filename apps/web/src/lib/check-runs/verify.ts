/**
 * The two check-run requests, without Next.js or Supabase (T19, protocol.md §8).
 * The route gives a store that acts as the learner in the Bearer token; tests give
 * one that runs the same queries on an in-memory database.
 *
 * Order matters and is fixed here:
 *   who is calling (Bearer) → look-ups → verifySubmission() → record stamp → database.
 * Nothing in the request body is believed before the step that proves it.
 */
import {
  issueChallenge, recordStamp, verifySubmission, type RefusalCode,
} from "@ruftech-academy/shared/signing";

export type ApiAnswer = { status: number; body: Record<string, unknown> };

export type CheckRunStore = {
  /** The learner's OWN device with this id (RLS hides everyone else's), or null. */
  ownDevice(deviceId: string): Promise<{ id: string; publicKey: string; revoked: boolean } | null>;
  /** The published row for this check and version, and whether it is the newest version of the check. */
  definition(checkId: string, version: string): Promise<{ id: number; sha256: string; current: boolean } | null>;
  /** record_check_run() as the learner. */
  record(input: { deviceId: string; definitionId: number; nonce: string; payload: string; signature: string; stamp: string }):
    Promise<{ id: number } | { error: "replay" | "refused" | "failed" }>;
};

export type CheckRunDeps = {
  store: CheckRunStore;
  /** Null when the two server keys are not set: the routes then answer 503. */
  keys: { challengeKey: Uint8Array; recordKey: Uint8Array } | null;
  /** The server clock, whole seconds. */
  now: () => number;
  /** Server log only. Never the payload, a token or a key. */
  log?: (line: string) => void;
};

export const MAX_SUBMISSION_BODY = 260_000;
export const MAX_CHALLENGE_BODY = 2_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const SHA256 = /^[0-9a-f]{64}$/;

const answer = (status: number, error: string, message: string): ApiAnswer => ({ status, body: { error, message } });
const NOT_READY = answer(503, "not_ready", "The platform is not set up to receive results yet.");
const BAD_DEVICE = answer(403, "device", "This device is not registered for your account, or it was revoked. Run npx academy login.");
// One answer for every refusal that could help someone probe the checks.
const REFUSED = answer(403, "refused", "The result was not accepted. Run the check again; if it keeps happening, run npx academy login.");

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** POST /api/check-runs/challenge — body { check_id, version, sha256, device_id }. */
export async function challengeRequest(userId: string, body: unknown, deps: CheckRunDeps): Promise<ApiAnswer> {
  if (!deps.keys) return NOT_READY;
  const input = record(body);
  const { check_id: checkId, version, sha256, device_id: deviceId } = input;
  if (typeof checkId !== "string" || !SLUG.test(checkId) || checkId.length > 80
    || typeof version !== "string" || !SEMVER.test(version) || version.length > 40
    || typeof sha256 !== "string" || !SHA256.test(sha256)
    || typeof deviceId !== "string" || !UUID.test(deviceId)) {
    return answer(400, "bad_request", "check_id, version, sha256 and device_id are required.");
  }
  const device = await deps.store.ownDevice(deviceId);
  if (!device || device.revoked) return BAD_DEVICE;
  const definition = await deps.store.definition(checkId, version);
  if (!definition) return answer(404, "unknown_check", "This check version is not published. Update the checker.");
  if (!definition.current) return answer(409, "outdated_check", "A newer version of this check is published. Update the checker.");
  if (definition.sha256 !== sha256) return answer(409, "check_changed", "Your copy of this check differs from the published one. Update the checker.");
  const issued = issueChallenge({ userId, deviceId: device.id, check: { id: checkId, version, sha256: definition.sha256 }, now: deps.now() }, deps.keys.challengeKey);
  return { status: 200, body: { challenge: issued.challenge, stamp: issued.stamp } };
}

/** What each refusal of verifySubmission() becomes for the CLI. The exact code goes to the server log only. */
function refusalAnswer(code: RefusalCode): ApiAnswer {
  if (code === "challenge_expired") return answer(409, "challenge_expired", "The check took too long to send. Run it again.");
  if (code === "payload_malformed" || code === "payload_invalid" || code === "challenge_malformed") return answer(400, "bad_request", "The result is not in the expected format. Update the checker.");
  return REFUSED;
}

/** Only to know which rows to look up. Nothing read here is trusted; verifySubmission() decides. */
function peekChallenge(challenge: string): { deviceId: string; checkId: string; version: string } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(challenge);
  } catch {
    return null;
  }
  const c = record(parsed);
  const check = record(c.check);
  if (typeof c.device_id !== "string" || !UUID.test(c.device_id)) return null;
  if (typeof check.id !== "string" || !SLUG.test(check.id) || check.id.length > 80) return null;
  if (typeof check.version !== "string" || !SEMVER.test(check.version) || check.version.length > 40) return null;
  return { deviceId: c.device_id, checkId: check.id, version: check.version };
}

/** POST /api/check-runs — body { challenge, stamp, payload, signature }: four strings, nothing else. */
export async function submitRequest(userId: string, body: unknown, deps: CheckRunDeps): Promise<ApiAnswer> {
  if (!deps.keys) return NOT_READY;
  const input = record(body);
  const { challenge, stamp, payload, signature } = input;
  if (typeof challenge !== "string" || challenge.length > 2000 || typeof stamp !== "string" || stamp.length > 100
    || typeof payload !== "string" || payload.length > 200_000 || typeof signature !== "string" || signature.length > 400
    || Object.keys(input).length !== 4) {
    return answer(400, "bad_request", "The request must hold challenge, stamp, payload and signature.");
  }
  const peek = peekChallenge(challenge);
  if (!peek) return answer(400, "bad_request", "The challenge is not readable.");

  // Look-ups as the learner: another learner's device is simply not found.
  const device = await deps.store.ownDevice(peek.deviceId);
  if (!device || device.revoked) return BAD_DEVICE;
  const definition = await deps.store.definition(peek.checkId, peek.version);
  if (!definition) return answer(404, "unknown_check", "This check version is not published. Update the checker.");

  const verified = verifySubmission(
    { challenge, stamp, payload, signature },
    {
      challengeKey: deps.keys.challengeKey,
      publicKey: device.publicKey,
      now: deps.now(),
      expected: { userId, deviceId: device.id, check: { id: peek.checkId, version: peek.version, sha256: definition.sha256 } },
    },
  );
  if (!verified.ok) {
    deps.log?.(`check-run refused: ${verified.code}`);
    return refusalAnswer(verified.code);
  }

  const nonce = verified.result.challenge.nonce;
  const recorded = await deps.store.record({
    deviceId: device.id,
    definitionId: definition.id,
    nonce,
    payload,
    signature,
    stamp: recordStamp({ userId, deviceId: device.id, definitionId: definition.id, nonce, payloadSha256: verified.payloadSha256 }, deps.keys.recordKey),
  });
  if ("id" in recorded) return { status: 201, body: { run_id: recorded.id, passed: verified.result.passed } };
  if (recorded.error === "replay") return answer(409, "already_recorded", "This result was already recorded.");
  deps.log?.(`check-run not recorded: ${recorded.error}`);
  return recorded.error === "refused" ? REFUSED : answer(500, "failed", "The result could not be recorded. Try again later.");
}

/**
 * The shell both routes share: who is calling comes first and only from the
 * Authorization header (the caller's `learnerOf`); then the size limit; then JSON.
 */
export async function cliRoute<L>(
  request: Request,
  options: { learnerOf: (request: Request) => Promise<L | null>; unauthorized: () => Response; maxBody: number },
  handle: (learner: L, body: unknown) => Promise<ApiAnswer>,
): Promise<Response> {
  const learner = await options.learnerOf(request);
  if (!learner) return options.unauthorized();
  const headers = { "Cache-Control": "no-store" };
  const text = await request.text();
  if (text.length > options.maxBody) return Response.json({ error: "bad_request", message: "The request is too large." }, { status: 413, headers });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "bad_request", message: "The request is not JSON." }, { status: 400, headers });
  }
  try {
    const out = await handle(learner, body);
    return Response.json(out.body, { status: out.status, headers });
  } catch (error) {
    console.error("check-runs route:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "failed", message: "Something went wrong. Try again later." }, { status: 500, headers });
  }
}

/** A database error code from record_check_run() → an outcome. */
export function recordErrorFrom(code: string | undefined): { error: "replay" | "refused" | "failed" } {
  if (code === "23505") return { error: "replay" };
  if (code === "42501" || code === "22023" || code === "23503" || code === "23514") return { error: "refused" };
  return { error: "failed" };
}
