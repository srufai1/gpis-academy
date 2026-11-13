/**
 * academy login (T18, ADR-7): sign in as the learner with an email one-time code, then
 * register this computer as a device. No browser step.
 */
import { isDeviceLabel, DEVICE_LABEL_MAX } from "@gpis-academy/shared/device";
import { CheckerError } from "../errors.ts";
import { newDeviceKey, readDeviceKey, saveDeviceKey, type DeviceKey } from "../device-key.ts";
import { authCall, readSession, saveSession, tokensFrom, type AuthConfig, type Fetch, type Session } from "../session.ts";

export type LoginDeps = {
  fetch: Fetch;
  ask: (question: string) => Promise<string>;
  print: (line: string) => void;
  hostname: () => string;
  now?: () => number;
};

const TRIES = 3;
const WRONG_CODE = "That code is not right, or it has expired.";

export function platformUrl(value: string | undefined): string {
  if (!value) throw new CheckerError("Which platform? Set ACADEMY_URL, or run: npx academy login --url=https://your-site.example");
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new CheckerError(`"${value}" is not a web address.`);
  }
  const local = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if ((url.protocol !== "https:" && !local) || url.search || url.hash || url.username || url.password) {
    throw new CheckerError(`"${value}" must be an https:// address (http:// only for localhost).`);
  }
  return url.origin + url.pathname.replace(/\/+$/, "");
}

/** The computer's name as a device label: one line, at most 80 characters. */
export function deviceLabel(hostname: string): string {
  const clean = hostname.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, DEVICE_LABEL_MAX);
  return isDeviceLabel(clean) && clean ? clean : "my computer";
}

async function platformJson(http: Fetch, url: string, init?: RequestInit): Promise<{ status: number; json: Record<string, unknown> }> {
  let response: Response;
  try {
    response = await http(url, init);
  } catch {
    throw new CheckerError(`Could not reach the platform at ${new URL(url).origin}. Check the address and your internet connection.`);
  }
  let json: Record<string, unknown> = {};
  try {
    const parsed: unknown = await response.json();
    if (parsed && typeof parsed === "object") json = parsed as Record<string, unknown>;
  } catch {
    // Status alone.
  }
  return { status: response.status, json };
}

async function authConfig(http: Fetch, platform: string): Promise<AuthConfig> {
  const { status, json } = await platformJson(http, `${platform}/api/cli/config`);
  const { supabase_url, publishable_key } = json;
  if (status !== 200 || typeof supabase_url !== "string" || typeof publishable_key !== "string") {
    throw new CheckerError(`The platform at ${platform} is not ready for sign-in (answer ${status}).`);
  }
  return { supabase_url: supabase_url.replace(/\/+$/, ""), publishable_key };
}

export async function login(options: { url?: string }, deps: LoginDeps): Promise<number> {
  const now = deps.now ?? Date.now;
  const platform = platformUrl(options.url ?? process.env.ACADEMY_URL ?? readSession()?.platform_url ?? readDeviceKey()?.platform_url);
  const config = await authConfig(deps.fetch, platform);

  const email = (await deps.ask("Your email: ")).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new CheckerError("That is not an email address.");
  // shouldCreateUser: false. An unknown email gets the same sentence as a known one.
  const sent = await authCall(deps.fetch, config, "otp", { email, create_user: false });
  if (sent.status === 429) throw new CheckerError("Too many codes were asked for. Wait a few minutes, then run npx academy login again.");
  if (sent.status >= 500) throw new CheckerError("The sign-in service is busy. Try again in a few minutes.");
  deps.print(`If ${email} has an account, a code is on its way. It works once and expires soon.`);

  let session: Session | null = null;
  for (let attempt = 1; attempt <= TRIES && !session; attempt++) {
    const code = (await deps.ask("Code from the email: ")).trim();
    if (/^\d{6,10}$/.test(code)) {
      const verified = await authCall(deps.fetch, config, "verify", { type: "email", email, token: code });
      if (verified.status >= 500) throw new CheckerError("The sign-in service is busy. Try again in a few minutes.");
      const tokens = verified.status === 200 ? tokensFrom(verified.json, Math.floor(now() / 1000)) : null;
      if (tokens) session = { ...config, platform_url: platform, email, ...tokens };
    }
    if (!session) deps.print(attempt < TRIES ? `${WRONG_CODE} Try again.` : `${WRONG_CODE} Run npx academy login again to get a new code.`);
  }
  if (!session) return 1;
  saveSession(session);

  const label = deviceLabel(deps.hostname());
  const kept = readDeviceKey();
  const first = kept && kept.platform_url === platform ? kept : newDeviceKey(platform);
  let result = await registerDevice(deps.fetch, platform, session.access_token, first, label, first === kept);
  if (result.retryWithNewKey) result = await registerDevice(deps.fetch, platform, session.access_token, newDeviceKey(platform), label, false);
  if (!result.device) {
    deps.print(result.message);
    return 1;
  }
  saveDeviceKey(result.device);
  deps.print(`Signed in as ${email}. This computer is registered as "${label}".`);
  return 0;
}

type RegisterResult = { device: DeviceKey; message?: undefined; retryWithNewKey?: false } | { device?: undefined; message: string; retryWithNewKey: boolean };

async function registerDevice(http: Fetch, platform: string, token: string, key: DeviceKey, label: string, keptKey: boolean): Promise<RegisterResult> {
  const { status, json } = await platformJson(http, `${platform}/api/devices`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ public_key: key.public_key, label }),
  });
  if ((status === 200 || status === 201) && typeof json.device_id === "string") return { device: { ...key, device_id: json.device_id } };
  const message = typeof json.message === "string" ? json.message : `The platform refused this device (answer ${status}).`;
  // A kept key that was revoked, or that another account registered: make a new key, once.
  const retryWithNewKey = keptKey && status === 409 && (json.error === "revoked" || json.error === "key_in_use");
  return { message, retryWithNewKey };
}
