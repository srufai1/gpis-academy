/**
 * The CLI's own Supabase session (T18, ADR-7). Stored in ~/.academy/session.json (mode 600),
 * apart from the device key. Tokens are never printed.
 *
 * The CLI talks to Supabase Auth directly only to send a code, check it, refresh and sign out;
 * everything else goes to the platform with "Authorization: Bearer <access token>".
 */
import { rmSync } from "node:fs";
import { join } from "node:path";
import { CheckerError } from "./errors.ts";
import { academyDir, readJson, writeSecretJson } from "./secret-file.ts";

export type Fetch = typeof fetch;
export type AuthConfig = { supabase_url: string; publishable_key: string };
export type Session = AuthConfig & {
  platform_url: string;
  email: string;
  access_token: string;
  refresh_token: string;
  /** Unix seconds. */
  expires_at: number;
};

export const sessionPath = (): string => join(academyDir(), "session.json");

const SIGN_IN_AGAIN = "Your sign-in has ended. Run npx academy login again.";
/** Refresh this many seconds before the access token expires. */
const MARGIN = 60;

export function readSession(): Session | null {
  const v = readJson(sessionPath());
  if (!v) return null;
  const strings = ["supabase_url", "publishable_key", "platform_url", "email", "access_token", "refresh_token"] as const;
  if (!strings.every((k) => typeof v[k] === "string" && v[k] !== "") || typeof v.expires_at !== "number") return null;
  return v as unknown as Session;
}

export const saveSession = (session: Session): void => writeSecretJson(sessionPath(), session);
export const deleteSession = (): void => rmSync(sessionPath(), { force: true });

/** A request to Supabase Auth. Network failures become a plain CheckerError. */
export async function authCall(http: Fetch, config: AuthConfig, path: string, body: unknown, accessToken?: string): Promise<{ status: number; json: Record<string, unknown> }> {
  let response: Response;
  try {
    response = await http(`${config.supabase_url}/auth/v1/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: config.publishable_key, authorization: `Bearer ${accessToken ?? config.publishable_key}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new CheckerError("Could not reach the sign-in service. Check your internet connection and try again.");
  }
  let json: Record<string, unknown> = {};
  try {
    const parsed: unknown = await response.json();
    if (parsed && typeof parsed === "object") json = parsed as Record<string, unknown>;
  } catch {
    // An empty or non-JSON answer: the status is enough.
  }
  return { status: response.status, json };
}

/** The tokens of a Supabase session answer, or null when it is not one. */
export function tokensFrom(json: Record<string, unknown>, nowSeconds: number): Pick<Session, "access_token" | "refresh_token" | "expires_at"> | null {
  const { access_token, refresh_token, expires_in, expires_at } = json;
  if (typeof access_token !== "string" || typeof refresh_token !== "string" || !access_token || !refresh_token) return null;
  const expiry = typeof expires_at === "number" ? expires_at : typeof expires_in === "number" ? nowSeconds + expires_in : nowSeconds;
  return { access_token, refresh_token, expires_at: expiry };
}

/**
 * A valid access token. Refreshes when it is about to expire, and saves the new refresh token
 * before using it: Supabase refresh tokens work once, so losing the new one means a new login.
 */
export async function accessToken(http: Fetch, now: () => number = Date.now): Promise<{ token: string; session: Session }> {
  const session = readSession();
  if (!session) throw new CheckerError("You are not signed in. Run npx academy login.");
  const nowSeconds = Math.floor(now() / 1000);
  if (session.expires_at - nowSeconds > MARGIN) return { token: session.access_token, session };

  const { status, json } = await authCall(http, session, "token?grant_type=refresh_token", { refresh_token: session.refresh_token });
  if (status >= 500 || status === 429) throw new CheckerError("The sign-in service is busy. Try again in a few minutes.");
  const tokens = status === 200 ? tokensFrom(json, nowSeconds) : null;
  if (!tokens) throw new CheckerError(SIGN_IN_AGAIN);
  const next = { ...session, ...tokens };
  saveSession(next);
  return { token: next.access_token, session: next };
}

/** The header every platform request from the CLI carries (T19 and T20 use this). */
export async function bearerHeader(http: Fetch, now?: () => number): Promise<{ authorization: string }> {
  const { token } = await accessToken(http, now);
  return { authorization: `Bearer ${token}` };
}
