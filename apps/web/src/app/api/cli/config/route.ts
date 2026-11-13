import { supabaseEnv } from "@/lib/supabase/env";

/**
 * GET /api/cli/config (ADR-7): the two public Supabase settings the CLI needs to sign in.
 * Both are public by design (the browser has them too). Nothing secret is ever here.
 */
export function GET() {
  const env = supabaseEnv();
  if (!env) {
    return Response.json({ error: "not_configured", message: "The platform is not set up yet." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({ supabase_url: env.url, publishable_key: env.key }, { headers: { "Cache-Control": "no-store" } });
}
