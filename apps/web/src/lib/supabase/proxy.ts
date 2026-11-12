import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { decideGate } from "@/lib/auth/gate";
import { supabaseEnv } from "./env";

/**
 * Refreshes the session cookie and applies the page gate (lib/auth/gate.ts).
 * Private pages are sent with Cache-Control: private, no-store.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = supabaseEnv();
  let signedIn = false;

  if (env) {
    const supabase = createServerClient(env.url, env.key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    });
    const { data } = await supabase.auth.getClaims();
    signedIn = typeof data?.claims?.sub === "string";
  }

  const decision = decideGate(request.nextUrl.pathname, signedIn);
  if (decision.kind === "redirect") {
    const url = request.nextUrl.clone();
    url.pathname = decision.to;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }
  if (decision.private) response.headers.set("Cache-Control", "private, no-store");
  return response;
}
