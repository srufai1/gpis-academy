/**
 * The two public Supabase settings, or null when they are not set (for example in CI).
 * A value that is set but wrong (not an https:// address, quotes, a key in the URL line)
 * is reported once in the server log with a plain sentence, and treated as not set,
 * so the public pages still open instead of crashing.
 */
let warned = false;

export function isValidSupabaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))
      && (url.pathname === "/" || url.pathname === "");
  } catch {
    return false;
  }
}

export function supabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return null;
  if (!isValidSupabaseUrl(url)) {
    if (!warned) {
      warned = true;
      console.error("NEXT_PUBLIC_SUPABASE_URL in apps/web/.env.local is not valid. It must look like https://abcd1234.supabase.co (no quotes, nothing after .co). Restart `npm run dev` after fixing it.");
    }
    return null;
  }
  return { url, key };
}
