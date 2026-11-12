import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SIGN_IN_PATH } from "@/lib/auth/gate";
import { getRequestClaims } from "@/lib/auth/request";

/** Signed-in pages. The proxy already redirects; this repeats the check on the server. */
export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  if (!(await getRequestClaims())) redirect(SIGN_IN_PATH);
  return <AppShell>{children}</AppShell>;
}
