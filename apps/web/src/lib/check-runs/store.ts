import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordErrorFrom, type CheckRunDeps, type CheckRunStore } from "./verify";

/** The store for the check-run routes: every query runs as the learner in the Bearer token (RLS applies). */
export function supabaseCheckRunStore(supabase: SupabaseClient): CheckRunStore {
  return {
    async ownDevice(deviceId) {
      const { data, error } = await supabase.from("devices").select("id, public_key, revoked_at").eq("id", deviceId).maybeSingle();
      if (error) throw new Error(`devices lookup failed: ${error.code}`);
      return data ? { id: data.id as string, publicKey: data.public_key as string, revoked: data.revoked_at !== null } : null;
    },
    async definition(checkId, version) {
      const { data, error } = await supabase.from("check_definitions").select("id, version, sha256")
        .eq("item_slug", checkId).order("id", { ascending: false });
      if (error) throw new Error(`check_definitions lookup failed: ${error.code}`);
      const rows = data ?? [];
      const row = rows.find((r) => r.version === version);
      return row ? { id: Number(row.id), sha256: row.sha256 as string, current: rows[0]?.version === version } : null;
    },
    async record(input) {
      const { data, error } = await supabase.rpc("record_check_run", {
        p_device_id: input.deviceId, p_definition_id: input.definitionId, p_nonce: input.nonce,
        p_payload: input.payload, p_signature: input.signature, p_stamp: input.stamp,
      });
      if (error) return recordErrorFrom(error.code);
      return typeof data === "number" || typeof data === "string" ? { id: Number(data) } : { error: "failed" };
    },
  };
}

/** 64 or more hex characters (32+ bytes), or null. */
function hexKey(value: string | undefined): Uint8Array | null {
  const text = value?.trim() ?? "";
  return /^(?:[0-9a-f]{2}){32,}$/i.test(text) ? Buffer.from(text, "hex") : null;
}

let warned = false;

/** The two server-only keys (protocol.md §5 and §6), or null when one is missing or malformed. */
export function checkRunKeys(): CheckRunDeps["keys"] {
  const challengeKey = hexKey(process.env.ACADEMY_CHALLENGE_KEY);
  const recordKey = hexKey(process.env.ACADEMY_RECORD_KEY);
  if (!challengeKey || !recordKey || Buffer.compare(challengeKey, recordKey) === 0) {
    if (!warned) {
      warned = true;
      console.error("ACADEMY_CHALLENGE_KEY and ACADEMY_RECORD_KEY must each be 64 hex characters, and different from each other. See docs/runbook-check-runs.md.");
    }
    return null;
  }
  return { challengeKey, recordKey };
}

export const serverNow = (): number => Math.floor(Date.now() / 1000);
