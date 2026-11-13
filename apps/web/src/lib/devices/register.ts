/**
 * POST /api/devices, without Next.js or Supabase (T18). The route gives it the body and a
 * store that acts as the signed-in learner; tests give it a fake one.
 */
import { isDeviceLabel, MAX_ACTIVE_DEVICES } from "@ruftech-academy/shared/device";
import { isDevicePublicKey } from "@ruftech-academy/shared/signing";

export type RegisterOutcome = { id: string } | { error: "key_in_use" | "too_many" | "invalid" | "failed" };

export type DeviceStore = {
  /** The learner's own device with this key (RLS), or null. */
  findOwn(publicKey: string): Promise<{ id: string; revoked: boolean } | null>;
  /** register_device() as the learner. */
  register(publicKey: string, label: string): Promise<RegisterOutcome>;
};

export type ApiAnswer = { status: number; body: Record<string, unknown> };

const TOO_MANY = `You already have ${MAX_ACTIVE_DEVICES} devices. Revoke one on the platform (Me → Devices), then run npx academy login again.`;

export async function registerDeviceRequest(body: unknown, store: DeviceStore): Promise<ApiAnswer> {
  const input = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const publicKey = input.public_key;
  const label = input.label;
  if (typeof publicKey !== "string" || !isDevicePublicKey(publicKey)) {
    return { status: 400, body: { error: "bad_request", message: "public_key is not a device public key." } };
  }
  if (!isDeviceLabel(label)) {
    return { status: 400, body: { error: "bad_request", message: "label is one line of at most 80 characters." } };
  }
  const own = await store.findOwn(publicKey);
  if (own && !own.revoked) return { status: 200, body: { device_id: own.id, existing: true } };
  if (own) return { status: 409, body: { error: "revoked", message: "This device was revoked." } };

  const outcome = await store.register(publicKey, label.trim());
  if ("id" in outcome) return { status: 201, body: { device_id: outcome.id, existing: false } };
  switch (outcome.error) {
    case "key_in_use": return { status: 409, body: { error: "key_in_use", message: "This key is already registered." } };
    case "too_many": return { status: 409, body: { error: "too_many_devices", message: TOO_MANY } };
    case "invalid": return { status: 400, body: { error: "bad_request", message: "The device was refused." } };
    default: return { status: 500, body: { error: "failed", message: "The device could not be registered. Try again later." } };
  }
}

/** A database error code from register_device() → an outcome. */
export function registerErrorFrom(code: string | undefined): RegisterOutcome {
  if (code === "23505") return { error: "key_in_use" };
  if (code === "23514") return { error: "too_many" };
  if (code === "22023") return { error: "invalid" };
  return { error: "failed" };
}
