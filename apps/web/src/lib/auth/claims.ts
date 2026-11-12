/**
 * Reads the signed-in user's claims once and remembers the answer, so a
 * render that asks several times makes one getClaims() call (T03).
 * request.ts wraps this per request with React's cache().
 */
export type Claims = { sub: string; email?: string; app_metadata?: Record<string, unknown> };

type ClaimsClient = {
  auth: { getClaims(): Promise<{ data: { claims: Record<string, unknown> } | null; error: unknown }> };
};

export function createClaimsLoader(client: ClaimsClient): () => Promise<Claims | null> {
  let pending: Promise<Claims | null> | null = null;
  return () => {
    pending ??= client.auth.getClaims().then(({ data, error }) => {
      const claims = data?.claims;
      if (error || !claims || typeof claims.sub !== "string") return null;
      return claims as Claims;
    }, () => null);
    return pending;
  };
}
