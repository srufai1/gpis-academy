/**
 * T03, offline: the page gate, one getClaims() per render, and plain error sentences.
 * No network and no real Supabase: a fake client stands in (like GPIS's D-163 harness).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decideGate, HOME_PATH, SIGN_IN_PATH } from "../apps/web/src/lib/auth/gate.ts";
import { createClaimsLoader } from "../apps/web/src/lib/auth/claims.ts";
import { AUTH_MESSAGES, authErrorMessage, readCredentials } from "../apps/web/src/lib/auth/messages.ts";
import { isValidSupabaseUrl } from "../apps/web/src/lib/supabase/env.ts";

let checks = 0;
const ok = (value: unknown, label: string) => { assert.ok(value, label); checks++; };
const same = (a: unknown, b: unknown, label: string) => { assert.deepEqual(a, b, label); checks++; };

// The four gate cases.
same(decideGate("/map", false), { kind: "redirect", to: SIGN_IN_PATH }, "signed out: /map goes to /sign-in");
same(decideGate("/sign-in", true), { kind: "redirect", to: HOME_PATH }, "signed in: /sign-in goes to /map");
same(decideGate("/sign-in", false), { kind: "next", private: false }, "signed out: /sign-in opens");
same(decideGate("/map", true), { kind: "next", private: true }, "signed in: /map opens as a private page");
same(decideGate("/sign-up", true), { kind: "redirect", to: HOME_PATH }, "signed in: /sign-up goes to /map");
same(decideGate("/", false), { kind: "next", private: false }, "landing is public");
same(decideGate("/course", false), { kind: "next", private: false }, "public course map is public");
for (const path of ["/progress", "/me", "/project/1", "/map/module-01", "/api/check-runs"])
  same(decideGate(path, false).kind, "redirect", `signed out: ${path} is closed`);

// One getClaims() per render.
let calls = 0;
const fake = { auth: { getClaims: async () => { calls++; return { data: { claims: { sub: "u1", email: "a@b.c" } }, error: null }; } } };
const load = createClaimsLoader(fake);
const [a, b, c] = await Promise.all([load(), load(), load()]);
same(calls, 1, "getClaims() is called once for three readers in one render");
same([a?.sub, b?.sub, c?.sub], ["u1", "u1", "u1"], "every reader gets the same claims");
const broken = createClaimsLoader({ auth: { getClaims: async () => { throw new Error("network"); } } });
same(await broken(), null, "a failed getClaims() means signed out, not an error page");
const noSub = createClaimsLoader({ auth: { getClaims: async () => ({ data: { claims: {} }, error: null }) } });
same(await noSub(), null, "claims without a user id mean signed out");

// Plain sentences only.
same(authErrorMessage({ code: "invalid_credentials" }), AUTH_MESSAGES.invalid, "wrong password");
same(authErrorMessage({ code: "user_already_exists" }), AUTH_MESSAGES.taken, "email taken");
same(authErrorMessage({ status: 429 }), AUTH_MESSAGES.tooMany, "rate limit");
same(authErrorMessage({ code: "unexpected_failure" }), AUTH_MESSAGES.general, "unknown error gets the general sentence");
const form = (email: string, password: string) => { const f = new FormData(); f.set("email", email); f.set("password", password); return f; };
same(readCredentials(form("bad", "longenough"), "sign-up"), { ok: false, error: AUTH_MESSAGES.badEmail }, "bad email refused on the server");
same(readCredentials(form("a@b.co", "short"), "sign-up"), { ok: false, error: AUTH_MESSAGES.weakPassword }, "short password refused on sign-up");
same(readCredentials(form("a@b.co", "short"), "sign-in"), { ok: false, error: AUTH_MESSAGES.invalid }, "short password is just wrong on sign-in");
same(readCredentials(form(" A@B.co ", "longenough"), "sign-in"), { ok: true, email: "a@b.co", password: "longenough" }, "email trimmed and lower-cased");

// The actions never return a raw Supabase message.
const actions = readFileSync(new URL("../apps/web/src/app/(auth)/actions.ts", import.meta.url), "utf8");
ok(!/error\.message/.test(actions), "actions never show error.message");
// Private pages are not cached.
const proxy = readFileSync(new URL("../apps/web/src/lib/supabase/proxy.ts", import.meta.url), "utf8");
ok(proxy.includes('"Cache-Control", "private, no-store"'), "private pages and redirects are sent no-store");

// Private pages render per request: cookies are read before the "is Supabase set up" check.
const server = readFileSync(new URL("../apps/web/src/lib/supabase/server.ts", import.meta.url), "utf8");
ok(server.indexOf("await cookies()") > -1 && server.indexOf("await cookies()") < server.indexOf("supabaseEnv()"), "cookies are read first, so private pages are never built once as static pages");

// A wrong Supabase URL is treated as "not set up" (with a log line), never a crash.
for (const good of ["https://abcd1234.supabase.co", "https://abcd1234.supabase.co/", "http://127.0.0.1:54321"]) ok(isValidSupabaseUrl(good), `valid URL: ${good}`);
for (const bad of ['"https://abcd1234.supabase.co"', "abcd1234.supabase.co", "https://abcd1234.supabase.co/rest/v1/", "sb_publishable_x", "http://abcd1234.supabase.co", ""]) ok(!isValidSupabaseUrl(bad), `refused URL: ${bad}`);

console.log(`Auth gate: ${checks} checks passed.`);
