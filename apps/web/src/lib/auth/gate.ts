/**
 * Who may open which page (T03). Pure, so it is tested without a network.
 * Public pages are open to everyone; sign-in and sign-up send a signed-in
 * visitor to the map; every other page needs a signed-in visitor.
 */
export const SIGN_IN_PATH = "/sign-in";
export const HOME_PATH = "/map";

const PUBLIC_PATHS = new Set(["/", "/course"]);
const AUTH_PATHS = new Set(["/sign-in", "/sign-up"]);

/**
 * The CLI's routes (ADR-7): the gate lets them through and each route answers 401 itself,
 * because the CLI signs in with a Bearer token, not a cookie.
 */
export function isCliApiPath(pathname: string): boolean {
  return pathname === "/api/devices" || pathname.startsWith("/api/cli/")
    || pathname === "/api/check-runs" || pathname.startsWith("/api/check-runs/");
}

export type GateDecision = { kind: "next"; private: boolean } | { kind: "redirect"; to: string };

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || AUTH_PATHS.has(pathname);
}

export function decideGate(pathname: string, signedIn: boolean): GateDecision {
  if (isCliApiPath(pathname)) return { kind: "next", private: true };
  if (AUTH_PATHS.has(pathname)) return signedIn ? { kind: "redirect", to: HOME_PATH } : { kind: "next", private: false };
  if (PUBLIC_PATHS.has(pathname)) return { kind: "next", private: false };
  return signedIn ? { kind: "next", private: true } : { kind: "redirect", to: SIGN_IN_PATH };
}
