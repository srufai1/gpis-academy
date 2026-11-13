/**
 * The checker result (T12, docs/protocol.md §3): what the CLI signs and the
 * platform records. Pure: no Node-only API.
 *
 * A result holds outcomes and short reasons only. It has no field that could
 * carry source code: every key is listed here, unknown keys are refused, and
 * free text is limited to one short line.
 *
 * Limits follow supabase/migrations/0004_devices_check_runs.sql:
 *   results ≤ 64 kB (kept to 32,768 canonical bytes here, well inside it),
 *   signature 32–400 chars, commit_sha 7–64 hex, nonce 16–128 chars.
 */
import { canonicalize } from "./canonical.ts";
import { STEP_KINDS } from "./content-schema.ts";

export type StepKind = (typeof STEP_KINDS)[number];

export const PROTOCOL_VERSION = 1;
export const RESULT_KIND = "academy.check-result";
export const CHALLENGE_KIND = "academy.challenge";

/** pass · fail · needs (something is missing on the machine, not a failure of the work) · skipped */
export const STEP_OUTCOMES = ["pass", "fail", "needs", "skipped"] as const;
export type StepOutcome = (typeof STEP_OUTCOMES)[number];

export const LIMITS = {
  resultsBytes: 32768,
  steps: 60,
  reasonsPerStep: 5,
  reasonChars: 300,
  titleChars: 120,
  nonceMin: 16,
  nonceMax: 128,
  challengeSeconds: 900,
  clockSkewSeconds: 60,
} as const;

export type CheckRef = { id: string; version: string; sha256: string };
export type StepResult = { id: string; kind: StepKind; title: string; required: boolean; outcome: StepOutcome; reasons: string[] };
export type Results = { steps: StepResult[] };

/** The signed payload. Field order here is for reading; the wire order is canonical (sorted). */
export type CheckResult = {
  v: 1;
  kind: typeof RESULT_KIND;
  check: CheckRef;
  challenge: { nonce: string; expires_at: number };
  device_id: string;
  user_id: string;
  commit: { sha: string | null; clean: boolean | null };
  checker_version: string;
  started_at: number;
  finished_at: number;
  passed: boolean;
  results: Results;
};

/** The one-time challenge the platform issues before a run. */
export type Challenge = {
  v: 1;
  kind: typeof CHALLENGE_KIND;
  nonce: string;
  user_id: string;
  device_id: string;
  check: CheckRef;
  issued_at: number;
  expires_at: number;
};

export type Validation<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const NONCE = /^[A-Za-z0-9_-]+$/;
const COMMIT = /^[0-9a-f]{7,64}$/;
// One line of ordinary text: no line breaks, tabs or other control characters.
const ONE_LINE = /^[^\u0000-\u001F\u007F\u2028\u2029]*$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isSeconds = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;

/** Exactly these keys, no more and no fewer. */
function keys(value: Record<string, unknown>, wanted: readonly string[], path: string, errors: string[]): void {
  for (const key of Object.keys(value)) if (!wanted.includes(key)) errors.push(`${path}.${key}: unknown field`);
  for (const key of wanted) if (!(key in value)) errors.push(`${path}.${key}: missing`);
}

function checkRef(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) { errors.push(`${path}: must be an object`); return; }
  keys(value, ["id", "sha256", "version"], path, errors);
  if (typeof value.id !== "string" || !SLUG.test(value.id) || value.id.length > 80) errors.push(`${path}.id: must be a check id like m1-p1`);
  if (typeof value.version !== "string" || !SEMVER.test(value.version) || value.version.length > 40) errors.push(`${path}.version: must look like 1.0.0`);
  if (typeof value.sha256 !== "string" || !SHA256.test(value.sha256)) errors.push(`${path}.sha256: must be 64 lowercase hex characters`);
}

function nonce(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== "string" || value.length < LIMITS.nonceMin || value.length > LIMITS.nonceMax || !NONCE.test(value))
    errors.push(`${path}: must be ${LIMITS.nonceMin}–${LIMITS.nonceMax} characters of A–Z a–z 0–9 _ -`);
}

function oneLine(value: unknown, max: number, min: number, path: string, errors: string[]): void {
  if (typeof value !== "string" || value.length < min || value.length > max || !ONE_LINE.test(value))
    errors.push(`${path}: must be one line of ${min}–${max} characters`);
}

function results(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) { errors.push(`${path}: must be an object`); return; }
  keys(value, ["steps"], path, errors);
  if (!Array.isArray(value.steps) || value.steps.length < 1 || value.steps.length > LIMITS.steps) {
    errors.push(`${path}.steps: must hold 1–${LIMITS.steps} steps`);
    return;
  }
  const seen = new Set<string>();
  value.steps.forEach((step: unknown, i: number) => {
    const at = `${path}.steps[${i}]`;
    if (!isRecord(step)) { errors.push(`${at}: must be an object`); return; }
    keys(step, ["id", "kind", "outcome", "reasons", "required", "title"], at, errors);
    if (typeof step.id !== "string" || !SLUG.test(step.id) || step.id.length > 60) errors.push(`${at}.id: must be a short id like fees-permissions`);
    else if (seen.has(step.id)) errors.push(`${at}.id: "${step.id}" is used twice`);
    else seen.add(step.id);
    if (!STEP_KINDS.includes(step.kind as StepKind)) errors.push(`${at}.kind: must be one of ${STEP_KINDS.join(", ")}`);
    if (!STEP_OUTCOMES.includes(step.outcome as StepOutcome)) errors.push(`${at}.outcome: must be one of ${STEP_OUTCOMES.join(", ")}`);
    if (typeof step.required !== "boolean") errors.push(`${at}.required: must be true or false`);
    oneLine(step.title, LIMITS.titleChars, 1, `${at}.title`, errors);
    if (!Array.isArray(step.reasons) || step.reasons.length > LIMITS.reasonsPerStep) errors.push(`${at}.reasons: at most ${LIMITS.reasonsPerStep} reasons`);
    else step.reasons.forEach((reason: unknown, r: number) => oneLine(reason, LIMITS.reasonChars, 1, `${at}.reasons[${r}]`, errors));
  });
}

/** The rule every side uses: passed = at least one required step, and every required step passed. */
export function passedFromSteps(steps: readonly Pick<StepResult, "required" | "outcome">[]): boolean {
  const required = steps.filter((step) => step.required);
  return required.length > 0 && required.every((step) => step.outcome === "pass");
}

/** Validate a parsed result payload. Never throws. */
export function validateResult(value: unknown): Validation<CheckResult> {
  const errors: string[] = [];
  if (!isRecord(value)) return { ok: false, errors: ["$: must be an object"] };
  keys(value, ["challenge", "check", "checker_version", "commit", "device_id", "finished_at", "kind", "passed", "results", "started_at", "user_id", "v"], "$", errors);
  if (value.v !== PROTOCOL_VERSION) errors.push(`$.v: must be ${PROTOCOL_VERSION}`);
  if (value.kind !== RESULT_KIND) errors.push(`$.kind: must be "${RESULT_KIND}"`);
  checkRef(value.check, "$.check", errors);
  if (!isRecord(value.challenge)) errors.push("$.challenge: must be an object");
  else {
    keys(value.challenge, ["expires_at", "nonce"], "$.challenge", errors);
    nonce(value.challenge.nonce, "$.challenge.nonce", errors);
    if (!isSeconds(value.challenge.expires_at)) errors.push("$.challenge.expires_at: must be a time in whole seconds");
  }
  if (typeof value.device_id !== "string" || !UUID.test(value.device_id)) errors.push("$.device_id: must be a lowercase UUID");
  if (typeof value.user_id !== "string" || !UUID.test(value.user_id)) errors.push("$.user_id: must be a lowercase UUID");
  if (!isRecord(value.commit)) errors.push("$.commit: must be an object");
  else {
    keys(value.commit, ["clean", "sha"], "$.commit", errors);
    if (value.commit.sha !== null && (typeof value.commit.sha !== "string" || !COMMIT.test(value.commit.sha))) errors.push("$.commit.sha: must be null or 7–64 lowercase hex characters");
    if (value.commit.clean !== null && typeof value.commit.clean !== "boolean") errors.push("$.commit.clean: must be null, true or false");
    if (value.commit.sha === null && value.commit.clean !== null) errors.push("$.commit.clean: must be null when there is no commit");
  }
  oneLine(value.checker_version, 40, 1, "$.checker_version", errors);
  if (!isSeconds(value.started_at)) errors.push("$.started_at: must be a time in whole seconds");
  if (!isSeconds(value.finished_at)) errors.push("$.finished_at: must be a time in whole seconds");
  if (isSeconds(value.started_at) && isSeconds(value.finished_at) && value.finished_at < value.started_at) errors.push("$.finished_at: is before started_at");
  if (typeof value.passed !== "boolean") errors.push("$.passed: must be true or false");
  results(value.results, "$.results", errors);
  if (errors.length === 0) {
    const steps = (value.results as Results).steps;
    if (value.passed !== passedFromSteps(steps)) errors.push("$.passed: does not match the steps (every required step must pass)");
    try {
      const bytes = new TextEncoder().encode(canonicalize(value.results)).length;
      if (bytes > LIMITS.resultsBytes) errors.push(`$.results: ${bytes} bytes; the limit is ${LIMITS.resultsBytes}`);
    } catch (error) {
      errors.push(`$.results: ${(error as Error).message}`);
    }
  }
  return errors.length === 0 ? { ok: true, value: value as unknown as CheckResult } : { ok: false, errors };
}

/** Validate a parsed challenge. Never throws. Time rules are checked in signing.ts. */
export function validateChallenge(value: unknown): Validation<Challenge> {
  const errors: string[] = [];
  if (!isRecord(value)) return { ok: false, errors: ["$: must be an object"] };
  keys(value, ["check", "device_id", "expires_at", "issued_at", "kind", "nonce", "user_id", "v"], "$", errors);
  if (value.v !== PROTOCOL_VERSION) errors.push(`$.v: must be ${PROTOCOL_VERSION}`);
  if (value.kind !== CHALLENGE_KIND) errors.push(`$.kind: must be "${CHALLENGE_KIND}"`);
  nonce(value.nonce, "$.nonce", errors);
  if (typeof value.user_id !== "string" || !UUID.test(value.user_id)) errors.push("$.user_id: must be a lowercase UUID");
  if (typeof value.device_id !== "string" || !UUID.test(value.device_id)) errors.push("$.device_id: must be a lowercase UUID");
  checkRef(value.check, "$.check", errors);
  if (!isSeconds(value.issued_at)) errors.push("$.issued_at: must be a time in whole seconds");
  if (!isSeconds(value.expires_at)) errors.push("$.expires_at: must be a time in whole seconds");
  if (isSeconds(value.issued_at) && isSeconds(value.expires_at)) {
    const life = value.expires_at - value.issued_at;
    if (life <= 0 || life > LIMITS.challengeSeconds) errors.push(`$.expires_at: a challenge lives 1–${LIMITS.challengeSeconds} seconds`);
  }
  return errors.length === 0 ? { ok: true, value: value as unknown as Challenge } : { ok: false, errors };
}
