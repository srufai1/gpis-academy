"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { HOME_PATH } from "@/lib/auth/gate";
import { AUTH_MESSAGES, authErrorMessage, readCredentials, readEmail, readNewPassword } from "@/lib/auth/messages";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = { error?: string; notice?: string };

export async function signIn(_state: AuthFormState, form: FormData): Promise<AuthFormState> {
  const input = readCredentials(form, "sign-in");
  if (!input.ok) return { error: input.error };
  const supabase = await createClient();
  if (!supabase) return { error: AUTH_MESSAGES.notConfigured };
  const { error } = await supabase.auth.signInWithPassword({ email: input.email, password: input.password });
  if (error) return { error: authErrorMessage(error) };
  redirect(HOME_PATH);
}

export async function signUp(_state: AuthFormState, form: FormData): Promise<AuthFormState> {
  const input = readCredentials(form, "sign-up");
  if (!input.ok) return { error: input.error };
  const supabase = await createClient();
  if (!supabase) return { error: AUTH_MESSAGES.notConfigured };
  const { data, error } = await supabase.auth.signUp({ email: input.email, password: input.password });
  if (error) return { error: authErrorMessage(error) };
  // With email confirmation on, there is no session until the link is opened.
  if (!data.session) return { notice: "Check your email and open the link to confirm your account. Then sign in." };
  redirect(HOME_PATH);
}

/** This site's own address, from the request. Supabase only sends links to addresses on its Redirect URLs list. */
async function siteOrigin(): Promise<string | null> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin && /^https?:\/\/[^/]+$/.test(origin)) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host || !/^[A-Za-z0-9.:-]+$/.test(host)) return null;
  const proto = h.get("x-forwarded-proto") === "http" || host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

/**
 * "Forgot password": Supabase emails a one-time link to /auth/confirm. The answer is the same
 * whether or not the email has an account, so the form cannot be used to find out who has one.
 */
export async function requestPasswordReset(_state: AuthFormState, form: FormData): Promise<AuthFormState> {
  const input = readEmail(form);
  if (!input.ok) return { error: input.error };
  const supabase = await createClient();
  const origin = await siteOrigin();
  if (!supabase || !origin) return { error: AUTH_MESSAGES.notConfigured };
  const { error } = await supabase.auth.resetPasswordForEmail(input.email, { redirectTo: `${origin}/auth/confirm?next=/reset-password` });
  if (error && (error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit")) {
    return { error: AUTH_MESSAGES.tooMany };
  }
  if (error) console.error("requestPasswordReset:", error.code ?? error.status);
  return { notice: AUTH_MESSAGES.resetSent };
}

/** Set the new password (the email link signed the learner in), then end every other session. */
export async function resetPassword(_state: AuthFormState, form: FormData): Promise<AuthFormState> {
  const input = readNewPassword(form);
  if (!input.ok) return { error: input.error };
  const supabase = await createClient();
  if (!supabase) return { error: AUTH_MESSAGES.notConfigured };
  const { error } = await supabase.auth.updateUser({ password: input.password });
  if (error) return { error: authErrorMessage(error) };
  await supabase.auth.signOut({ scope: "others" });
  return { notice: AUTH_MESSAGES.passwordChanged };
}
