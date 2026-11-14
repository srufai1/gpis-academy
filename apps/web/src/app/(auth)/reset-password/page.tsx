import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getRequestClaims } from "@/lib/auth/request";
import { resetPassword } from "../actions";
import { ResetForm } from "../password-forms";

export const metadata: Metadata = { title: "Choose a new password" };

/** Reached from the email link (/auth/confirm signs the learner in first). */
export default async function ResetPasswordPage() {
  const claims = await getRequestClaims();
  if (!claims) redirect("/forgot-password?link=expired");
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Choose a new password</h1>
      {claims.email ? <p className="text-muted-foreground">For {claims.email}</p> : null}
      <ResetForm action={resetPassword} />
    </div>
  );
}
