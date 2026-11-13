/**
 * Device rules shared by the CLI and the platform route (T18, ADR-7).
 * The database checks the same rules again in register_device().
 */
export const DEVICE_LABEL_MAX = 80;
export const MAX_ACTIVE_DEVICES = 5;

/** One line of at most 80 characters, no control characters. */
export function isDeviceLabel(label: unknown): label is string {
  return typeof label === "string" && label.length <= DEVICE_LABEL_MAX && !/[\u0000-\u001f\u007f]/.test(label);
}

/** "Bearer <token>" → the token, or null. One space, nothing else. */
export function bearerToken(header: string | null | undefined): string | null {
  const match = typeof header === "string" ? /^Bearer ([A-Za-z0-9._~+/=-]{20,4096})$/.exec(header) : null;
  return match ? match[1]! : null;
}
