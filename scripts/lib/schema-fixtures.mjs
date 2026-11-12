/**
 * Fixture rows for the database tests, written as the database owner.
 * check_runs has no door until T19, so its fixture row is inserted by the
 * owner; the tests then prove that no API role can do the same.
 */
import { actAs, createUser, rows } from "./pglite-schema.mjs";

const HASH = "a".repeat(64);

export async function seed(db) {
  const a = await createUser(db, { email: "a@example.test", fullName: "Learner A" });
  const b = await createUser(db, { email: "b@example.test", fullName: "Learner B" });
  await actAs(db, null);
  await db.exec(`
    insert into public.content_items (slug, kind, parent_slug, position, title, guidance, content_hash) values
      ('m1', 'module', null, 1, 'Command line and Git', 'guided', '${HASH}'),
      ('m1-u1', 'unit', 'm1', 1, 'The terminal and the filesystem', 'guided', '${HASH}'),
      ('m1-u1-quiz', 'quiz', 'm1-u1', 3, 'Quiz', null, '${HASH}'),
      ('m1-p1', 'project', 'm1-u1', 4, 'Find your way', 'guided', '${HASH}');
    insert into public.check_definitions (item_slug, version, sha256) values ('m1-p1', '1.0.0', '${HASH}');
  `);
  const [definition] = await rows(db, "select id from public.check_definitions");
  const out = { a, b, definitionId: definition.id, hash: HASH };
  for (const [key, user] of [["a", a], ["b", b]]) {
    const [device] = await rows(db,
      "insert into public.devices (user_id, public_key, label) values ($1, $2, 'laptop') returning id",
      [user.id, `ed25519:${key.repeat(43)}`]);
    await db.query("insert into public.progress (user_id, item_slug, state) values ($1, 'm1-u1', 'read')", [user.id]);
    await db.query(
      "insert into public.quiz_attempts (user_id, item_slug, answers, score, content_hash) values ($1, 'm1-u1-quiz', '{\"q1\":0}', 5, $2)",
      [user.id, HASH]);
    await db.query(
      "insert into public.reviews (user_id, item_slug, checklist, explanation, gpis_comparison) values ($1, 'm1-p1', '{\"typed\":true}', 'I moved the file.', 'GPIS keeps scripts executable.')",
      [user.id]);
    const [run] = await rows(db,
      `insert into public.check_runs (user_id, device_id, definition_id, nonce, commit_sha, tree_clean, passed, results, signature, checker_version)
       values ($1, $2, $3, $4, 'a1b2c3d', true, true, '{"steps":[]}', $5, '0.1.0') returning id`,
      [user.id, device.id, definition.id, `nonce-${key}-0123456789abcdef`, "s".repeat(88)]);
    out[key] = { ...user, deviceId: device.id, runId: run.id };
  }
  return out;
}

/** A complete, valid check_runs insert for `user`, to prove that only the privilege stops it. */
export const CHECK_RUN_INSERT = `
  insert into public.check_runs (user_id, device_id, definition_id, nonce, passed, results, signature, checker_version)
  values ($1, $2, $3, $4, true, '{"steps":[]}', '${"s".repeat(88)}', '0.1.0')`;
