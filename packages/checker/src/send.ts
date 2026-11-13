/**
 * Sending a result to the platform (T20, protocol.md §11). The order is fixed:
 *   1. before the steps run: ask for a challenge (one-time nonce, 15 minutes);
 *   2. the steps run;
 *   3. build the result, check it against the schema, sign it with the device key, send it.
 * Whatever goes wrong online, the local result is still printed; the CLI then says, in one
 * sentence, that it was not recorded and why. Tokens and the private key are never printed.
 */
import { spawnSync } from "node:child_process";
import type { CheckResult, StepResult } from "@ruftech-academy/shared/result-schema";
import { validateResult } from "@ruftech-academy/shared/result-schema";
import { signResult } from "@ruftech-academy/shared/signing";
import { readDeviceKey, type DeviceKey } from "./device-key.ts";
import { CheckerError } from "./errors.ts";
import { bearerHeader, readSession, type Fetch } from "./session.ts";
import { CHECKER_VERSION } from "./version.ts";

export type SendDeps = { fetch: Fetch; now: () => number };
export type CheckRef = { id: string; version: string; sha256: string };

/** A challenge in hand: the run may be recorded. */
export type Ticket = { platform: string; key: DeviceKey; challenge: string; stamp: string; userId: string; nonce: string; expiresAt: number };
export type Prepared = { ok: true; ticket: Ticket } | { ok: false; note: string };

const NOT_SIGNED_IN = "you are not signed in on this computer. Run npx academy login.";
const NOT_REGISTERED = "this computer is not registered. Run npx academy login.";

async function post(http: Fetch, url: string, headers: Record<string, string>, body: unknown): Promise<{ status: number; json: Record<string, unknown> } | null> {
  let response: Response;
  try {
    response = await http(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  } catch {
    return null;
  }
  let json: Record<string, unknown> = {};
  try {
    const parsed: unknown = await response.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) json = parsed as Record<string, unknown>;
  } catch {
    // Status alone.
  }
  return { status: response.status, json };
}

const serverSays = (json: Record<string, unknown>, status: number): string =>
  typeof json.message === "string" && json.message.length <= 300 ? json.message.replace(/\.$/, "") + "." : `the platform answered ${status}.`;

/** The Bearer header, or the sentence that says why there is none. */
async function authorization(deps: SendDeps): Promise<{ authorization: string } | string> {
  try {
    return await bearerHeader(deps.fetch, deps.now);
  } catch (error) {
    if (error instanceof CheckerError) return error.message.charAt(0).toLowerCase() + error.message.slice(1);
    throw error;
  }
}

/** Step 1: ask the platform for a challenge for this check, before anything runs. */
export async function prepareSend(check: CheckRef, deps: SendDeps): Promise<Prepared> {
  const session = readSession();
  if (!session) return { ok: false, note: NOT_SIGNED_IN };
  const key = readDeviceKey();
  if (!key || !key.device_id || key.platform_url !== session.platform_url) return { ok: false, note: NOT_REGISTERED };
  const auth = await authorization(deps);
  if (typeof auth === "string") return { ok: false, note: auth };

  const answer = await post(deps.fetch, `${session.platform_url}/api/check-runs/challenge`, auth,
    { check_id: check.id, version: check.version, sha256: check.sha256, device_id: key.device_id });
  if (!answer) return { ok: false, note: `could not reach the platform at ${session.platform_url}.` };
  if (answer.status !== 200) {
    if (answer.json.error === "outdated_check" || answer.json.error === "check_changed") {
      return { ok: false, note: `${serverSays(answer.json, answer.status)} Update the checker (see the course's install page), then run the check again.` };
    }
    return { ok: false, note: serverSays(answer.json, answer.status) };
  }
  const { challenge, stamp } = answer.json;
  if (typeof challenge !== "string" || typeof stamp !== "string") return { ok: false, note: "the platform's answer was not understood." };
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(challenge) as Record<string, unknown>;
  } catch {
    return { ok: false, note: "the platform's answer was not understood." };
  }
  const c = parsed.check as Record<string, unknown> | undefined;
  if (typeof parsed.user_id !== "string" || typeof parsed.nonce !== "string" || typeof parsed.expires_at !== "number"
    || parsed.device_id !== key.device_id || c?.id !== check.id || c?.version !== check.version || c?.sha256 !== check.sha256) {
    return { ok: false, note: "the platform's challenge does not match this check." };
  }
  return { ok: true, ticket: { platform: session.platform_url, key, challenge, stamp, userId: parsed.user_id, nonce: parsed.nonce, expiresAt: parsed.expires_at } };
}

/** The commit the work folder is on, and whether it has uncommitted changes. Never file contents. */
export function commitOf(dir: string): CheckResult["commit"] {
  const head = spawnSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8", timeout: 10_000 });
  const sha = head.status === 0 ? head.stdout.trim() : "";
  if (!/^[0-9a-f]{7,64}$/.test(sha)) return { sha: null, clean: null };
  const status = spawnSync("git", ["-C", dir, "status", "--porcelain"], { encoding: "utf8", timeout: 10_000 });
  return { sha, clean: status.status === 0 ? status.stdout.trim() === "" : null };
}

/** Step 3: build, check, sign and send. Returns the sentence for the report's last line. */
export async function sendResult(
  ticket: Ticket,
  run: { check: CheckRef; steps: StepResult[]; passed: boolean; startedAt: number; finishedAt: number; commit: CheckResult["commit"] },
  deps: SendDeps,
): Promise<{ recorded: boolean; note: string }> {
  if (run.finishedAt > ticket.expiresAt) {
    return { recorded: false, note: "not recorded: the check took longer than 15 minutes. Run it again." };
  }
  const result: CheckResult = {
    v: 1, kind: "academy.check-result", check: run.check,
    challenge: { nonce: ticket.nonce, expires_at: ticket.expiresAt },
    device_id: ticket.key.device_id!, user_id: ticket.userId, commit: run.commit,
    checker_version: CHECKER_VERSION, started_at: run.startedAt, finished_at: run.finishedAt,
    passed: run.passed, results: { steps: run.steps },
  };
  const valid = validateResult(result);
  if (!valid.ok) return { recorded: false, note: `not recorded: the result does not fit the format (${valid.errors[0]}). Please report this.` };
  const { payload, signature } = signResult(result, ticket.key.private_seed);

  // The access token may have expired while the steps ran: ask again (refreshes when needed).
  const auth = await authorization(deps);
  if (typeof auth === "string") return { recorded: false, note: `not recorded: ${auth}` };
  const answer = await post(deps.fetch, `${ticket.platform}/api/check-runs`, auth, { challenge: ticket.challenge, stamp: ticket.stamp, payload, signature });
  if (!answer) return { recorded: false, note: `not recorded: could not reach the platform at ${ticket.platform}. Run the check again when you are online.` };
  if (answer.status === 201) {
    const id = typeof answer.json.run_id === "number" ? ` (run ${answer.json.run_id})` : "";
    return { recorded: true, note: `recorded on the platform${id}` };
  }
  // A retry after a lost answer: the platform already has this run.
  if (answer.status === 409 && answer.json.error === "already_recorded") return { recorded: true, note: "recorded on the platform" };
  return { recorded: false, note: `not recorded: ${serverSays(answer.json, answer.status)}` };
}
