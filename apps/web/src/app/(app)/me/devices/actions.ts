"use server";

import { revalidatePath } from "next/cache";
import { requireLearner } from "@/lib/auth/learner";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Revoke one of the learner's devices (T18). Sets revoked_at; nothing is deleted. RLS keeps it to own rows. */
export async function revokeDevice(formData: FormData) {
  const id = formData.get("device_id");
  if (typeof id !== "string" || !UUID.test(id)) return;
  const { supabase } = await requireLearner();
  const { error } = await supabase.from("devices").update({ revoked_at: new Date().toISOString() }).eq("id", id).is("revoked_at", null);
  if (error) console.error("revokeDevice:", error.code);
  revalidatePath("/me/devices");
}
