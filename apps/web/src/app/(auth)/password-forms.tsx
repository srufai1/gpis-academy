"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { AuthFormState } from "./actions";

type Action = (state: AuthFormState, form: FormData) => Promise<AuthFormState>;
const field = "block min-h-11 w-full rounded-lg border bg-card px-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/40";

function Messages({ state }: { state: AuthFormState }) {
  return (
    <>
      {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
      {state.notice ? <p role="status" className="text-sm">{state.notice}</p> : null}
    </>
  );
}

/** "Forgot password": one email field. */
export function ForgotForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-4">
      <label className="block space-y-1">
        <span className="text-sm font-medium">Email</span>
        <input name="email" type="email" required autoComplete="email" inputMode="email" maxLength={254} className={field} />
      </label>
      <Messages state={state} />
      <Button type="submit" size="lg" className="w-full" disabled={pending} aria-busy={pending || undefined}>
        {pending ? "Please wait…" : "Send the link"}
      </Button>
      <p className="text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/sign-in" className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline">Sign in</Link>
      </p>
    </form>
  );
}

/** A new password, typed twice. */
export function ResetForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  if (state.notice) {
    return (
      <div className="space-y-4">
        <p role="status">{state.notice}</p>
        <Button asChild size="lg" className="w-full"><Link href="/map">Go to the course map</Link></Button>
      </div>
    );
  }
  return (
    <form action={formAction} className="space-y-4">
      <label className="block space-y-1">
        <span className="text-sm font-medium">New password</span>
        <input name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" className={field} />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">New password again</span>
        <input name="password_again" type="password" required minLength={8} maxLength={72} autoComplete="new-password" className={field} />
      </label>
      <p className="text-sm text-muted-foreground">At least 8 characters.</p>
      <Messages state={state} />
      <Button type="submit" size="lg" className="w-full" disabled={pending} aria-busy={pending || undefined}>
        {pending ? "Please wait…" : "Save the new password"}
      </Button>
    </form>
  );
}
