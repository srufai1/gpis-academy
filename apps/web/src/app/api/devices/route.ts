import { bearerLearner, signInAgain } from "@/lib/auth/bearer";
import { registerDeviceRequest, registerErrorFrom, type DeviceStore } from "@/lib/devices/register";

const MAX_BODY = 2000;

/** POST /api/devices (T18): register this CLI install as a device of the learner in the Bearer token. */
export async function POST(request: Request) {
  const learner = await bearerLearner(request);
  if (!learner) return signInAgain();
  const text = await request.text();
  if (text.length > MAX_BODY) return Response.json({ error: "bad_request", message: "The request is too large." }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "bad_request", message: "The request is not JSON." }, { status: 400 });
  }

  const { supabase } = learner;
  const store: DeviceStore = {
    async findOwn(publicKey) {
      const { data, error } = await supabase.from("devices").select("id, revoked_at").eq("public_key", publicKey).maybeSingle();
      if (error) throw new Error(`devices lookup failed: ${error.code}`);
      return data ? { id: data.id as string, revoked: data.revoked_at !== null } : null;
    },
    async register(publicKey, label) {
      const { data, error } = await supabase.rpc("register_device", { p_public_key: publicKey, p_label: label });
      if (error) return registerErrorFrom(error.code);
      return typeof data === "string" ? { id: data } : { error: "failed" };
    },
  };
  try {
    const answer = await registerDeviceRequest(body, store);
    return Response.json(answer.body, { status: answer.status, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("POST /api/devices:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "failed", message: "The device could not be registered. Try again later." }, { status: 500 });
  }
}
