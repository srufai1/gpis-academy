"use server";

import { redirect } from "next/navigation";
import { HOME_PATH } from "@/lib/auth/gate";
import { AUTH_MESSAGES, authErrorMessage, readCredentials } from "@/lib/auth/messages";
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
