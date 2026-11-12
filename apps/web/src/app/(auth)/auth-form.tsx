"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { AuthFormState } from "./actions";

type Props = {
  action: (state: AuthFormState, form: FormData) => Promise<AuthFormState>;
  submitLabel: string;
  passwordAutoComplete: "current-password" | "new-password";
  switchText: string;
  switchHref: string;
  switchLabel: string;
};

/** Email and password form shared by sign-in and sign-up. */
export function AuthForm({ action, submitLabel, passwordAutoComplete, switchText, switchHref, switchLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-4" noValidate={false}>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Email</span>
        <input name="email" type="email" required autoComplete="email" inputMode="email" maxLength={254}
          className="block min-h-11 w-full rounded-lg border bg-card px-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/40" />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Password</span>
        <input name="password" type="password" required minLength={8} maxLength={72} autoComplete={passwordAutoComplete}
          className="block min-h-11 w-full rounded-lg border bg-card px-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/40" />
      </label>
      {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
      {state.notice ? <p role="status" className="text-sm">{state.notice}</p> : null}
      <Button type="submit" size="lg" className="w-full" disabled={pending} aria-busy={pending || undefined}>
        {pending ? "Please wait…" : submitLabel}
      </Button>
      <p className="text-sm text-muted-foreground">
        {switchText}{" "}
        <Link href={switchHref} className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline">
          {switchLabel}
        </Link>
      </p>
    </form>
  );
}
