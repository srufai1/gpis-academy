import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SIGN_IN_PATH } from "./gate";
import { getRequestClaims } from "./request";

/** A signed-in learner and a database client, or a redirect to sign-in. Claims are read first. */
export async function requireLearner() {
  const claims = await getRequestClaims();
  if (!claims) redirect(SIGN_IN_PATH);
  const supabase = await createClient();
  if (!supabase) redirect(SIGN_IN_PATH);
  return { claims, supabase };
}
