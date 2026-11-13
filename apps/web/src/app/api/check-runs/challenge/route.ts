import { bearerLearner, signInAgain } from "@/lib/auth/bearer";
import { checkRunKeys, serverNow, supabaseCheckRunStore } from "@/lib/check-runs/store";
import { challengeRequest, cliRoute, MAX_CHALLENGE_BODY } from "@/lib/check-runs/verify";

// node:crypto is used for the stamp: this route must not run on the Edge runtime.
export const runtime = "nodejs";

/** POST /api/check-runs/challenge (T19): a one-time challenge for (learner, device, check). Bearer only (ADR-7). */
export async function POST(request: Request) {
  return cliRoute(request, { learnerOf: bearerLearner, unauthorized: signInAgain, maxBody: MAX_CHALLENGE_BODY }, (learner, body) =>
    challengeRequest(learner.userId, body, { store: supabaseCheckRunStore(learner.supabase), keys: checkRunKeys(), now: serverNow }));
}
