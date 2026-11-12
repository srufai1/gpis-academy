import type { Metadata } from "next";
import { signUp } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Create an account" };

export default function SignUpPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Create an account</h1>
      <AuthForm action={signUp} submitLabel="Create account" passwordAutoComplete="new-password"
        switchText="Already have an account?" switchHref="/sign-in" switchLabel="Sign in" />
    </div>
  );
}
