import type { Metadata } from "next";
import Link from "next/link";
import { signIn } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <AuthForm action={signIn} submitLabel="Sign in" passwordAutoComplete="current-password"
        switchText="New here?" switchHref="/sign-up" switchLabel="Create an account" />
      <p className="text-sm">
        <Link href="/forgot-password" className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline">Forgot password?</Link>
      </p>
    </div>
  );
}
