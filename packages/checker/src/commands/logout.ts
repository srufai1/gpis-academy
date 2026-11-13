/**
 * academy logout (T18, ADR-7): end this computer's session. The device key stays; revoking the
 * device on the platform (Me → Devices) is what stops its results.
 */
import { deleteSession, readSession, accessToken, authCall, type Fetch } from "../session.ts";

export async function logout(deps: { fetch: Fetch; print: (line: string) => void; now?: () => number }): Promise<number> {
  const session = readSession();
  if (!session) {
    deps.print("You were not signed in on this computer.");
    return 0;
  }
  try {
    const { token } = await accessToken(deps.fetch, deps.now);
    await authCall(deps.fetch, session, "logout?scope=local", {}, token);
  } catch {
    // The session may already be over; the local file is removed either way.
  }
  deleteSession();
  deps.print("Signed out on this computer. To stop this computer's results too, revoke it on the platform (Me → Devices).");
  return 0;
}
