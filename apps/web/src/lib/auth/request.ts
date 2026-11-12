import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createClaimsLoader, type Claims } from "./claims";

/**
 * The signed-in user's claims for this request. React's cache() makes every
 * caller in one render share a single getClaims() call. Call this before any
 * database query in a Server Component (AGENTS.md rule 2).
 */
export const getRequestClaims = cache(async (): Promise<Claims | null> => {
  const client = await createClient();
  return client ? createClaimsLoader(client)() : null;
});
