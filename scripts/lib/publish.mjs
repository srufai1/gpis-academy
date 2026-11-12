/**
 * Publishes content/index.json and content/manifest.json into content_items and
 * check_definitions (T06). `query(sql, params)` is any client that returns { rows }
 * (pg in real use, PGlite in tests). Runs as the database owner.
 *
 * Rules: nothing is ever deleted; a published check version is never changed —
 * a new version is a new row; a changed hash under the same version is refused.
 */
const FIELDS = ["kind", "parent_slug", "position", "title", "guidance", "content_hash"];

export async function planPublish(query, index, manifest) {
  const existingItems = new Map((await query("select slug, kind, parent_slug, position, title, guidance, content_hash from public.content_items")).rows.map((r) => [r.slug, r]));
  const existingChecks = (await query("select item_slug, version, sha256 from public.check_definitions")).rows;

  const items = [];
  for (const item of index.items) {
    const before = existingItems.get(item.slug);
    if (!before) items.push({ op: "insert", item });
    else {
      const changed = FIELDS.filter((f) => (before[f] ?? null) !== (item[f] ?? null));
      if (changed.length) items.push({ op: "update", item, changed });
    }
  }
  const checks = [];
  const refused = [];
  for (const check of manifest.checks) {
    const before = existingChecks.find((c) => c.item_slug === check.id && c.version === check.version);
    if (!before) checks.push({ op: "insert", check });
    else if (before.sha256 !== check.sha256) refused.push(`${check.id} ${check.version}: already published with a different hash; give the check a new version`);
  }
  const notInIndex = [...existingItems.keys()].filter((slug) => !index.items.some((i) => i.slug === slug));
  return { items, checks, refused, notInIndex };
}

export function describePlan(plan) {
  const lines = [];
  for (const { op, item, changed } of plan.items) lines.push(`${op === "insert" ? "add   " : "change"} ${item.kind} ${item.slug}${changed ? ` (${changed.join(", ")})` : ""}`);
  for (const { check } of plan.checks) lines.push(`add    check ${check.id} ${check.version}`);
  for (const slug of plan.notInIndex) lines.push(`keep   ${slug} (no longer in the index; never deleted)`);
  for (const reason of plan.refused) lines.push(`REFUSED ${reason}`);
  if (!plan.items.length && !plan.checks.length && !plan.refused.length) lines.push("Nothing to change.");
  return lines;
}

/** Writes the plan in one transaction. Refuses everything if any check was refused. */
export async function applyPublish(query, plan) {
  if (plan.refused.length) throw new Error(`Nothing written:\n${plan.refused.join("\n")}`);
  await query("begin");
  try {
    for (const { op, item } of plan.items) {
      const values = [item.slug, ...FIELDS.map((f) => item[f] ?? null)];
      if (op === "insert") {
        await query("insert into public.content_items (slug, kind, parent_slug, position, title, guidance, content_hash) values ($1, $2, $3, $4, $5, $6, $7)", values);
      } else {
        await query("update public.content_items set kind = $2, parent_slug = $3, position = $4, title = $5, guidance = $6, content_hash = $7 where slug = $1", values);
      }
    }
    for (const { check } of plan.checks) {
      await query("insert into public.check_definitions (item_slug, version, sha256) values ($1, $2, $3)", [check.id, check.version, check.sha256]);
    }
    await query("commit");
  } catch (error) {
    await query("rollback");
    throw error;
  }
}
