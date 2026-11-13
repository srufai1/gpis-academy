import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { bearerToken } from "@ruftech-academy/shared/device";
import { supabaseEnv } from "@/lib/supabase/env";

/**
 * The learner behind a CLI request (ADR-7): only from "Authorization: Bearer <access token>",
 * never from a cookie, so a web page cannot make these requests for a signed-in visitor.
 * Returns null for no token, an expired or forged one, or Supabase not set up: answer 401.
 * The client acts as that learner, so RLS applies exactly as in the browser.
 */
export async function bearerLearner(request: Request): Promise<{ userId: string; supabase: SupabaseClient } | null> {
  const token = bearerToken(request.headers.get("authorization"));
  const env = supabaseEnv();
  if (!token || !env) return null;
  const supabase = createClient(env.url, env.key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  try {
    const { data, error } = await supabase.auth.getClaims(token);
    const sub = data?.claims?.sub;
    if (error || typeof sub !== "string") return null;
    return { userId: sub, supabase };
  } catch {
    return null;
  }
}

/** The 401 every CLI route answers when bearerLearner() is null. */
export function signInAgain(): Response {
  return Response.json(
    { error: "sign_in", message: "Sign-in needed: run npx academy login." },
    { status: 401, headers: { "WWW-Authenticate": "Bearer", "Cache-Control": "no-store" } },
  );
}
