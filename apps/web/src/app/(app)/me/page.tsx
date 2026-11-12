import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { getRequestClaims } from "@/lib/auth/request";
import { signOut } from "./actions";

export const metadata: Metadata = { title: "Me" };

export default async function MePage() {
  const claims = await getRequestClaims();
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">Me</h1>
      {claims?.email ? <p className="text-muted-foreground">{claims.email}</p> : null}
      <form action={signOut}>
        <Button type="submit" variant="outline">Sign out</Button>
      </form>
    </div>
  );
}
