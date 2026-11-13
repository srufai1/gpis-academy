/** T18: register_device() in PGlite — the only way a device is created (ADR-7). */
import assert from "node:assert/strict";
import { generateDeviceKeyPair } from "../packages/shared/src/signing.ts";
import { as, createUser, expectRefused, freshDatabase, rows, runner } from "./lib/pglite-schema.mjs";

const db = await freshDatabase();
const { test, done } = runner("register_device");
const a = await createUser(db, { email: "a@example.test" });
const b = await createUser(db, { email: "b@example.test" });
const key = () => generateDeviceKeyPair().publicKey;
const register = (who, publicKey, label = "laptop") =>
  as(db, who, () => db.query("select public.register_device($1, $2) id", [publicKey, label]));

await test("a signed-in learner registers a device for themselves", async () => {
  const k = key();
  const { rows: [r] } = await register(a.id, k, "  my laptop  ");
  const [d] = await rows(db, "select user_id, public_key, label, revoked_at from public.devices where id = $1", [r.id]);
  assert.deepEqual(d, { user_id: a.id, public_key: k, label: "my laptop", revoked_at: null });
});

await test("a signed-out caller cannot run it", async () => {
  await as(db, "anon", () => expectRefused(db, "select public.register_device($1, 'x')", [key()], /permission denied/));
  await as(db, "service", () => expectRefused(db, "select public.register_device($1, 'x')", [key()], /permission denied/));
});

await test("a bad key, a bad label and a key already registered are refused", async () => {
  for (const bad of ["", "ed25519:short", "ed25519:" + "A".repeat(43) + "=", "rsa:" + "A".repeat(43), "ed25519:" + "A".repeat(42) + "B"]) {
    await as(db, a.id, () => expectRefused(db, "select public.register_device($1, 'x')", [bad], /not a device public key/));
  }
  await as(db, a.id, () => expectRefused(db, "select public.register_device($1, $2)", [key(), "x".repeat(81)], /one line/));
  await as(db, a.id, () => expectRefused(db, "select public.register_device($1, $2)", [key(), "two\nlines"], /one line/));
  const k = key();
  await register(a.id, k);
  await as(db, a.id, () => expectRefused(db, "select public.register_device($1, 'x')", [k], /duplicate key|unique/));
  await as(db, b.id, () => expectRefused(db, "select public.register_device($1, 'x')", [k], /duplicate key|unique/));
});

await test("a 6th device that is not revoked is refused; revoking one makes room", async () => {
  const c = await createUser(db, { email: "c@example.test" });
  for (let i = 0; i < 5; i++) await register(c.id, key());
  await as(db, c.id, () => expectRefused(db, "select public.register_device($1, 'x')", [key()], /at most 5 devices/));
  await as(db, c.id, () => db.query("update public.devices set revoked_at = now() where id = (select id from public.devices limit 1)"));
  await register(c.id, key());
  const [{ n }] = await rows(db, "select count(*)::int n from public.devices where user_id = $1", [c.id]);
  assert.equal(n, 6, "revoked devices stay; nothing is deleted");
});

await test("another learner cannot see the device", async () => {
  const seen = await as(db, b.id, () => rows(db, "select 1 from public.devices where user_id = $1", [a.id]));
  assert.deepEqual(seen, []);
});

done();
