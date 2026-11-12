import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "./env";

/** Supabase client for Server Components and Server Actions; null when Supabase is not set up. */
export async function createClient() {
  // Read cookies first, even when Supabase is not set up: it makes every page that asks
  // for the user render per request, never once at build time.
  const cookieStore = await cookies();
  const env = supabaseEnv();
  if (!env) return null;
  return createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component; the proxy refreshes the session instead.
        }
      },
    },
  });
}
