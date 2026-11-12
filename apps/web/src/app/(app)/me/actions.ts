"use server";

import { redirect } from "next/navigation";
import { SIGN_IN_PATH } from "@/lib/auth/gate";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase?.auth.signOut();
  redirect(SIGN_IN_PATH);
}
