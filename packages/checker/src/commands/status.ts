/**
 * academy status [<id>] (T20): who this computer is signed in as, and the newest results the
 * platform has recorded. Tokens and keys are never printed.
 */
import { readDeviceKey } from "../device-key.ts";
import { bearerHeader, readSession, type Fetch } from "../session.ts";

type Run = { run_id: number; check_id: string; version: string; current_version: boolean; passed: boolean; commit_sha: string | null; recorded_at: string };

export async function status(id: string | undefined, deps: { fetch: Fetch; print: (line: string) => void; now?: () => number }): Promise<number> {
  const session = readSession();
  const key = readDeviceKey();
  if (!session) {
    deps.print("Not signed in on this computer. Run: npx academy login");
    return 1;
  }
  deps.print(`Signed in as ${session.email} on ${session.platform_url}`);
  deps.print(key?.device_id && key.platform_url === session.platform_url ? `This computer is a registered device.` : "This computer is not registered yet. Run: npx academy login");

  const { authorization } = await bearerHeader(deps.fetch, deps.now);
  const url = `${session.platform_url}/api/check-runs/recent${id ? `?check=${encodeURIComponent(id)}` : ""}`;
  let response: Response;
  try {
    response = await deps.fetch(url, { headers: { authorization } });
  } catch {
    deps.print(`Could not reach the platform at ${session.platform_url}.`);
    return 1;
  }
  const body = (await response.json().catch(() => ({}))) as { runs?: Run[]; message?: string };
  if (response.status !== 200 || !Array.isArray(body.runs)) {
    deps.print(typeof body.message === "string" ? body.message : `The platform answered ${response.status}.`);
    return 1;
  }
  if (body.runs.length === 0) {
    deps.print(id ? `No results recorded for ${id} yet.` : "No results recorded yet.");
    return 0;
  }
  deps.print(id ? `Newest results for ${id}:` : "Newest results:");
  for (const r of body.runs) {
    const when = r.recorded_at.slice(0, 16).replace("T", " ");
    const old = r.current_version ? "" : " (an earlier version of the check)";
    deps.print(`  ${r.passed ? "PASSED    " : "NOT PASSED"}  ${r.check_id.padEnd(7)} v${r.version}  ${when} UTC  commit ${r.commit_sha?.slice(0, 7) ?? "none"}  run ${r.run_id}${old}`);
  }
  return 0;
}
