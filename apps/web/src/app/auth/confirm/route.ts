import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth/messages";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /auth/confirm — where Supabase's email links land (password reset).
 * Two link styles are accepted:
 *   ?token_hash=…&type=recovery   (the recommended email template; works on any device)
 *   ?code=…                       (Supabase's default template; works in the browser that asked)
 * On success the learner is signed in and sent to `next`, a path on this site only.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"), "/reset-password");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const code = url.searchParams.get("code");
  const supabase = await createClient();
  let ok = false;
  if (supabase && tokenHash && type === "recovery" && tokenHash.length <= 200) {
    ok = !(await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash })).error;
  } else if (supabase && code && code.length <= 200) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  }
  redirect(ok ? next : "/forgot-password?link=expired");
}
