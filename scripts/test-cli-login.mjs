/**
 * T18, offline: academy login / logout and the session store, against a fake Supabase Auth and
 * a fake platform. The fake platform runs the real POST /api/devices logic (lib/devices/register.ts)
 * on PGlite as the learner in the Bearer token, so register_device() is the real function.
 */
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { as, createUser, freshDatabase, rows } from "./lib/pglite-schema.mjs";

const home = mkdtempSync(join(tmpdir(), "academy-login-home-"));
process.env.HOME = home;
delete process.env.ACADEMY_URL;

const { login, platformUrl, deviceLabel } = await import("../packages/checker/src/commands/login.ts");
const { logout } = await import("../packages/checker/src/commands/logout.ts");
const { accessToken, readSession, sessionPath } = await import("../packages/checker/src/session.ts");
const { readDeviceKey, deviceKeyPath } = await import("../packages/checker/src/device-key.ts");
const { CheckerError } = await import("../packages/checker/src/errors.ts");
const { registerDeviceRequest, registerErrorFrom } = await import("../apps/web/src/lib/devices/register.ts");
const { bearerToken, isDeviceLabel } = await import("../packages/shared/src/device.ts");

let n = 0;
const ok = (v, label) => { assert.ok(v, label); n++; };
const eq = (a, b, label) => { assert.deepEqual(a, b, label); n++; };

const PLATFORM = "https://academy.example.test";
const SUPABASE = "https://project.supabase.example.test";
const db = await freshDatabase();
const a = await createUser(db, { email: "a@example.test" });
const b = await createUser(db, { email: "b@example.test" });

// ---------------------------------------------------------------- fake Supabase Auth
let clock = Date.UTC(2026, 10, 13, 9, 0, 0);
const users = new Map([[a.email, a.id], [b.email, b.id]]);
const codes = new Map(); // email -> { code, expires, used }
const access = new Map(); // access token -> { user, expires }
const refresh = new Map(); // refresh token -> { user, used }
const issued = []; // every secret the fake handed out, to prove none is printed
const token = (prefix) => { const t = `${prefix}-${randomBytes(24).toString("base64url")}`; issued.push(t); return t; };
function session(user) {
  const at = token("access"), rt = token("refresh");
  access.set(at, { user, expires: clock + 3600_000 });
  refresh.set(rt, { user, used: false });
  return { access_token: at, refresh_token: rt, expires_in: 3600, token_type: "bearer" };
}
let lastCode = null;
function auth(path, body) {
  if (path === "otp") {
    if (body.create_user !== false) return [400, { msg: "the CLI must not create users" }];
    if (!users.has(body.email)) return [422, { error_code: "otp_disabled", msg: "Signups not allowed for otp" }];
    lastCode = String(100000 + Math.floor(Math.random() * 899999));
    issued.push(lastCode);
    codes.set(body.email, { code: lastCode, expires: clock + 300_000, used: false });
    return [200, {}];
  }
  if (path === "verify") {
    const c = codes.get(body.email);
    if (!c || c.used || c.code !== body.token || clock > c.expires || body.type !== "email") return [403, { error_code: "otp_expired" }];
    c.used = true;
    return [200, session(users.get(body.email))];
  }
  if (path === "token?grant_type=refresh_token") {
    const r = refresh.get(body.refresh_token);
    if (!r || r.used) return [400, { error_code: "refresh_token_already_used" }];
    r.used = true;
    return [200, session(r.user)];
  }
  if (path === "logout?scope=local") return [204, null];
  return [404, {}];
}

// ---------------------------------------------------------------- fake platform
const learnerOf = (headers) => {
  const t = bearerToken(new Headers(headers).get("authorization"));
  const s = t && access.get(t);
  return s && s.expires > clock ? s.user : null;
};
async function platform(path, init) {
  if (path === "/api/cli/config") return [200, { supabase_url: SUPABASE, publishable_key: "sb_publishable_example" }];
  if (path === "/api/devices" && init?.method === "POST") {
    const user = learnerOf(init.headers);
    if (!user) return [401, { error: "sign_in" }];
    const store = {
      findOwn: (k) => as(db, user, async () => {
        const [d] = await rows(db, "select id, revoked_at from public.devices where public_key = $1", [k]);
        return d ? { id: d.id, revoked: d.revoked_at !== null } : null;
      }),
      register: (k, label) => as(db, user, async () => {
        try {
          return { id: (await db.query("select public.register_device($1, $2) id", [k, label])).rows[0].id };
        } catch (error) {
          return registerErrorFrom(error.code);
        }
      }),
    };
    const answer = await registerDeviceRequest(JSON.parse(init.body), store);
    return [answer.status, answer.body];
  }
  return [404, {}];
}

let offline = false;
const fakeFetch = async (url, init = {}) => {
  if (offline) throw new TypeError("fetch failed");
  const u = new URL(url);
  const [status, body] = u.origin === SUPABASE
    ? auth(u.pathname.replace("/auth/v1/", "") + u.search, JSON.parse(init.body ?? "{}"))
    : await platform(u.pathname, init);
  return new Response(body === null ? null : JSON.stringify(body), { status });
};

// ---------------------------------------------------------------- helpers
function terminal(answers) {
  const lines = [];
  const queue = [...answers];
  return {
    lines,
    deps: {
      fetch: fakeFetch,
      print: (l) => lines.push(String(l)),
      ask: async (q) => {
        lines.push(q);
        const next = queue.shift();
        return typeof next === "function" ? next() : next ?? "";
      },
      hostname: () => "learner-laptop",
      now: () => clock,
    },
  };
}
const mode = (p) => statSync(p).mode & 0o777;
const devicesOf = (user) => rows(db, "select id, public_key, label, revoked_at from public.devices where user_id = $1 order by created_at", [user]);
const noSecretPrinted = (lines, label) => {
  const text = lines.join("\n");
  const key = readDeviceKey();
  const secrets = [...issued.filter((s) => !/^\d+$/.test(s)), ...(key ? [key.private_seed] : [])];
  ok(secrets.every((s) => !text.includes(s)), `${label}: no token or private key in the output`);
};

// ---------------------------------------------------------------- tests
{
  const t = terminal([a.email, () => lastCode]);
  eq(await login({ url: PLATFORM }, t.deps), 0, "happy path: exit 0");
  ok(t.lines.some((l) => l.includes(`Signed in as ${a.email}`)), "says who is signed in");
  const [d] = await devicesOf(a.id);
  eq([d.label, d.public_key, d.revoked_at], ["learner-laptop", readDeviceKey().public_key, null], "the device is A's, with this computer's name and key");
  eq(readDeviceKey().device_id, d.id, "the device id is saved with the key");
  eq([mode(sessionPath()), mode(deviceKeyPath()), mode(join(home, ".academy"))], [0o600, 0o600, 0o700], "both files are mode 600; the folder 700");
  ok(sessionPath() !== deviceKeyPath(), "session and private key are separate files");
  ok(!JSON.stringify(readSession()).includes(readDeviceKey().private_seed), "the session file does not hold the private key");
  noSecretPrinted(t.lines, "login");
}

{
  const before = readDeviceKey();
  const t = terminal([a.email, () => lastCode]);
  eq(await login({}, t.deps), 0, "login again (platform remembered from the session)");
  eq([readDeviceKey().public_key, readDeviceKey().device_id], [before.public_key, before.device_id], "same machine: the key and device are kept");
  eq((await devicesOf(a.id)).length, 1, "no second device");
}

{
  const t = terminal([a.email, "000000", "12", "999999"]);
  const saved = readFileSync(sessionPath(), "utf8");
  eq(await login({ url: PLATFORM }, t.deps), 1, "three wrong codes: exit 1");
  eq(t.lines.filter((l) => l.startsWith("Code from the email")).length, 3, "at most 3 tries per code");
  ok(t.lines.at(-1).includes("Run npx academy login again"), "after 3 tries it says to start again");
  eq(readFileSync(sessionPath(), "utf8"), saved, "a failed login changes nothing on disk");
}

{
  const t = terminal([a.email, () => { const c = lastCode; clock += 301_000; return c; }, () => lastCode, () => lastCode]);
  eq(await login({ url: PLATFORM }, t.deps), 1, "expired code refused");
  const used = terminal([a.email, () => lastCode]);
  eq(await login({ url: PLATFORM }, used.deps), 0, "a fresh code works");
  const code = lastCode;
  const reuse = terminal([a.email, () => code, () => code, () => code]);
  codes.set(a.email, { ...codes.get(a.email), code }); // the old code again, already used
  eq(await login({ url: PLATFORM }, reuse.deps), 1, "a used code is refused");
}

{
  const known = terminal([a.email, "000000", "000000", "000000"]);
  const unknown = terminal(["nobody@example.test", "000000", "000000", "000000"]);
  await login({ url: PLATFORM }, known.deps);
  await login({ url: PLATFORM }, unknown.deps);
  eq(unknown.lines.map((l) => l.replace("nobody@example.test", "X")), known.lines.map((l) => l.replace(a.email, "X")), "an unknown email gets exactly the same messages as a wrong code");
}

{
  const first = readSession();
  eq((await accessToken(fakeFetch, () => clock)).token, first.access_token, "a fresh token is used as it is");
  clock += 3600_000;
  const { token: renewed } = await accessToken(fakeFetch, () => clock);
  const saved = readSession();
  ok(renewed !== first.access_token && saved.access_token === renewed, "an expired token is refreshed");
  ok(saved.refresh_token !== first.refresh_token && refresh.get(first.refresh_token).used, "the refresh token rotates and the new one is saved");
  eq(mode(sessionPath()), 0o600, "still mode 600 after the rewrite");
  ok(!readdirSync(join(home, ".academy")).some((f) => f.endsWith(".tmp")), "no temp file left behind");
  clock += 3600_000;
  refresh.get(saved.refresh_token).used = true; // e.g. signed out everywhere
  await assert.rejects(accessToken(fakeFetch, () => clock), (e) => e instanceof CheckerError && /academy login again/.test(e.message)); n++;
  offline = true;
  await assert.rejects(accessToken(fakeFetch, () => clock), (e) => e instanceof CheckerError && /internet/.test(e.message)); n++;
  offline = false;
}

{
  const t = terminal([a.email, () => lastCode]);
  await login({ url: PLATFORM }, t.deps);
  const old = readDeviceKey();
  await as(db, a.id, () => db.query("update public.devices set revoked_at = now() where id = $1", [old.device_id]));
  const again = terminal([a.email, () => lastCode]);
  eq(await login({ url: PLATFORM }, again.deps), 0, "login after a revoke");
  ok(readDeviceKey().public_key !== old.public_key, "a revoked device gets a new key");
  const ds = await devicesOf(a.id);
  eq([ds.length, ds.filter((d) => d.revoked_at === null).length], [2, 1], "the revoked device stays; one active device");
}

{
  // B logs in on the same computer: A's kept key is not B's, so B gets a new key and device.
  const t = terminal([b.email, () => lastCode]);
  eq(await login({ url: PLATFORM }, t.deps), 0, "another learner signs in");
  const [bd] = await devicesOf(b.id);
  eq(readDeviceKey().device_id, bd.id, "B's device is B's");
  eq(await as(db, b.id, () => rows(db, "select 1 from public.devices where user_id = $1", [a.id])), [], "B cannot see A's devices");
}

{
  const t = terminal([]);
  eq(await logout(t.deps), 0, "logout");
  ok(!existsSync(sessionPath()) && existsSync(deviceKeyPath()), "logout removes the session and keeps the device key");
  await assert.rejects(accessToken(fakeFetch, () => clock), /not signed in/); n++;
}

// Small rules.
eq([platformUrl("https://x.test/"), platformUrl("http://localhost:3000")], ["https://x.test", "http://localhost:3000"], "platform address");
for (const bad of ["http://x.test", "ftp://x", "https://x.test/?a=1", "nope"]) assert.throws(() => platformUrl(bad), CheckerError);
n++;
assert.throws(() => platformUrl(undefined), /ACADEMY_URL/); n++;
eq([deviceLabel("a\nb"), deviceLabel("x".repeat(100)).length, deviceLabel("")], ["ab", 80, "my computer"], "device label: one line, at most 80");
eq([isDeviceLabel("x".repeat(81)), isDeviceLabel("a\tb"), isDeviceLabel(5)], [false, false, false], "label rule refuses long, control characters, non-text");
const jwt = "eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXJl";
eq([bearerToken(`Bearer ${jwt}`), bearerToken(null), bearerToken(`bearer ${jwt}`), bearerToken(`Bearer  ${jwt}`), bearerToken("Bearer short")], [jwt, null, null, null, null], "only an exact Bearer header counts; a cookie-only request has none");
const refused = await registerDeviceRequest({ public_key: "ed25519:bad", label: "x" }, { findOwn: async () => null, register: async () => ({ id: "x" }) });
eq(refused.status, 400, "the route refuses a bad key before the database");
const tooMany = await registerDeviceRequest({ public_key: readDeviceKey().public_key.replace(/.$/, "A"), label: "x" }, { findOwn: async () => null, register: async () => registerErrorFrom("23514") });
eq([tooMany.status, tooMany.body.error], [409, "too_many_devices"], "a 6th device gets a plain message");


console.log(`CLI login: ${n} checks passed.`);
