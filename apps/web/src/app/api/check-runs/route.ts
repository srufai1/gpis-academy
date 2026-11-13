import { bearerLearner, signInAgain } from "@/lib/auth/bearer";
import { checkRunKeys, serverNow, supabaseCheckRunStore } from "@/lib/check-runs/store";
import { cliRoute, MAX_SUBMISSION_BODY, submitRequest } from "@/lib/check-runs/verify";

// node:crypto is used to verify the signature and the stamps: not the Edge runtime.
export const runtime = "nodejs";

/** POST /api/check-runs (T19): verify a signed result (protocol.md §8) and record it. Bearer only (ADR-7). */
export async function POST(request: Request) {
  return cliRoute(request, { learnerOf: bearerLearner, unauthorized: signInAgain, maxBody: MAX_SUBMISSION_BODY }, (learner, body) =>
    submitRequest(learner.userId, body, {
      store: supabaseCheckRunStore(learner.supabase),
      keys: checkRunKeys(),
      now: serverNow,
      log: (line) => console.error(line),
    }));
}
