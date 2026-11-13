/**
 * The device key (T18, ADR-7): an Ed25519 key pair whose only job is to sign results.
 * The private seed stays in ~/.academy/device-key.json (mode 600). It is never printed
 * and never sent; only the public key goes to the platform.
 */
import { join } from "node:path";
import { generateDeviceKeyPair, isDevicePublicKey } from "@ruftech-academy/shared/signing";
import { academyDir, readJson, writeSecretJson } from "./secret-file.ts";

export type DeviceKey = { platform_url: string; device_id: string | null; public_key: string; private_seed: string };

export const deviceKeyPath = (): string => join(academyDir(), "device-key.json");

export function readDeviceKey(): DeviceKey | null {
  const v = readJson(deviceKeyPath());
  if (!v || typeof v.platform_url !== "string" || typeof v.public_key !== "string" || typeof v.private_seed !== "string") return null;
  if (!isDevicePublicKey(v.public_key)) return null;
  return { platform_url: v.platform_url, device_id: typeof v.device_id === "string" ? v.device_id : null, public_key: v.public_key, private_seed: v.private_seed };
}

export function newDeviceKey(platformUrl: string): DeviceKey {
  const pair = generateDeviceKeyPair();
  return { platform_url: platformUrl, device_id: null, public_key: pair.publicKey, private_seed: pair.privateSeed };
}

export const saveDeviceKey = (key: DeviceKey): void => writeSecretJson(deviceKeyPath(), key);
