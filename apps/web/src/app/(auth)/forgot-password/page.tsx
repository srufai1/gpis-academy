import type { Metadata } from "next";
import { AUTH_MESSAGES } from "@/lib/auth/messages";
import { requestPasswordReset } from "../actions";
import { ForgotForm } from "../password-forms";

export const metadata: Metadata = { title: "Forgot password" };

type Props = { searchParams: Promise<{ link?: string }> };

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const expired = (await searchParams).link === "expired";
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Forgot password</h1>
      {expired ? <p role="alert" className="text-sm text-destructive">{AUTH_MESSAGES.linkExpired}</p> : null}
      <p className="text-muted-foreground">Type your email. We send you a link to choose a new password.</p>
      <ForgotForm action={requestPasswordReset} />
    </div>
  );
}
