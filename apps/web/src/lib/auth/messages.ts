/**
 * Plain sentences for sign-in and sign-up errors. A raw Supabase message is
 * never shown; unknown errors get the general sentence.
 */
export const AUTH_MESSAGES = {
  invalid: "That email or password is not right.",
  unconfirmed: "Confirm your email first. Check your inbox for the link.",
  taken: "An account with this email already exists. Sign in instead.",
  weakPassword: "Use a password of at least 8 characters.",
  badEmail: "Enter a valid email address.",
  tooMany: "Too many tries. Wait a minute and try again.",
  notConfigured: "Sign-in is not set up yet.",
  general: "Something went wrong. Please try again.",
  resetSent: "If that email has an account, we sent it a link to choose a new password. Check your inbox, and Spam. The link works once.",
  linkExpired: "That link has expired or was already used. Ask for a new one below.",
  mismatch: "The two passwords are not the same.",
  samePassword: "Choose a password different from your old one.",
  passwordChanged: "Your password is changed. You are signed out everywhere else.",
} as const;

export type AuthMessageKey = keyof typeof AUTH_MESSAGES;

export function authErrorMessage(error: { code?: string; status?: number } | null | undefined): string {
  const code = error?.code ?? "";
  if (code === "invalid_credentials") return AUTH_MESSAGES.invalid;
  if (code === "email_not_confirmed") return AUTH_MESSAGES.unconfirmed;
  if (code === "user_already_exists" || code === "email_exists") return AUTH_MESSAGES.taken;
  if (code === "weak_password") return AUTH_MESSAGES.weakPassword;
  if (code === "same_password") return AUTH_MESSAGES.samePassword;
  if (code === "email_address_invalid") return AUTH_MESSAGES.badEmail;
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit" || error?.status === 429) return AUTH_MESSAGES.tooMany;
  return AUTH_MESSAGES.general;
}

/** Server-side form checks, repeated from the form itself (validate on both sides). */
export function readCredentials(form: FormData, mode: "sign-in" | "sign-up"): { ok: true; email: string; password: string } | { ok: false; error: string } {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return { ok: false, error: AUTH_MESSAGES.badEmail };
  // On sign-in a too-short password is simply wrong; on sign-up it is too weak.
  if (password.length < 8 || password.length > 72) return { ok: false, error: mode === "sign-in" ? AUTH_MESSAGES.invalid : AUTH_MESSAGES.weakPassword };
  return { ok: true, email, password };
}

/** The email of the "forgot password" form, checked on the server. */
export function readEmail(form: FormData): { ok: true; email: string } | { ok: false; error: string } {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return { ok: false, error: AUTH_MESSAGES.badEmail };
  return { ok: true, email };
}

/** A new password, typed twice: 8–72 characters, both the same. */
export function readNewPassword(form: FormData): { ok: true; password: string } | { ok: false; error: string } {
  const password = String(form.get("password") ?? "");
  const again = String(form.get("password_again") ?? "");
  if (password.length < 8 || password.length > 72) return { ok: false, error: AUTH_MESSAGES.weakPassword };
  if (password !== again) return { ok: false, error: AUTH_MESSAGES.mismatch };
  return { ok: true, password };
}

/**
 * Where a link may send the learner after signing them in: a path on THIS site only.
 * "//evil.example", "/\\evil.example" and full addresses are refused (open-redirect protection).
 */
export function safeNext(next: string | null | undefined, fallback = "/map"): string {
  if (typeof next !== "string" || !/^\/[A-Za-z0-9/_-]*$/.test(next) || next.startsWith("//")) return fallback;
  return next;
}
