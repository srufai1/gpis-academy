import type { Metadata } from "next";
import { signIn } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <AuthForm action={signIn} submitLabel="Sign in" passwordAutoComplete="current-password"
        switchText="New here?" switchHref="/sign-up" switchLabel="Create an account" />
    </div>
  );
}
