# Runbook — turning on check results (T19)

Do these once per environment (your computer, then Vercel). Nothing here is done by an agent:
the keys are secrets and only you handle them.

## What you are setting up

| Thing | Where it lives | Used for |
| :--- | :--- | :--- |
| `ACADEMY_CHALLENGE_KEY` | The web app's server settings only | Stamps the one-time challenge (`protocol.md` §5) |
| `ACADEMY_RECORD_KEY` | The web app's server settings **and** the database | Proves to the database that the route sent a result (`protocol.md` §6) |
| Migration `0007_record_check_run.sql` | The Supabase project | The function `record_check_run()` and the key table |

Both keys are 64 hex characters (32 bytes). They must be different from each other.

## Steps

**1. Apply the migration.** In the Supabase SQL editor, run the whole file
`supabase/migrations/0007_record_check_run.sql`. Migrations 0001–0006 must already be applied.

**2. Make two keys.** In your WSL terminal, run this twice and keep the two lines apart:

```bash
openssl rand -hex 32
```

**3. Give both keys to the web app.** In `apps/web/.env.local` (never committed):

```text
ACADEMY_CHALLENGE_KEY=<first line>
ACADEMY_RECORD_KEY=<second line>
```

On Vercel, add the same two names under Settings → Environment Variables. Do **not** give them
the `NEXT_PUBLIC_` prefix. Restart `npm run dev` (or redeploy) afterwards.

**4. Give the record key to the database.** In the Supabase SQL editor, with the second line
in place of the placeholder:

```sql
insert into private.server_keys (name, key)
values ('record', decode('PASTE_THE_RECORD_KEY_HERE', 'hex'))
on conflict (name) do update set key = excluded.key;
```

Do not save this query as a snippet and do not paste it anywhere else: it holds the key.

**5. Check.**

```sql
select name, octet_length(key) as bytes from private.server_keys;
```

Expected: one row, `record`, `32`. The key itself is not shown.

## What you will see when something is missing

| Symptom in the CLI | Cause |
| :--- | :--- |
| "The platform is not set up to receive results yet." (503) | One of the two settings is missing, not 64 hex characters, or both are the same |
| "The result could not be recorded. Try again later." (500) | Step 4 was not done (no key in the database), or the migration is not applied |
| "The result was not accepted…" (403) on every run | The record key in the web app differs from the one in the database |

## Changing a key later

- **Challenge key:** change the setting and redeploy. Challenges issued before the change stop
  working; the learner runs the check again.
- **Record key:** change the setting and run step 4 again, close together. Recorded results
  are not affected; they never depend on the key again.

## Notes

- `private.server_keys` cannot be read through the API by any role, signed in or not. Only
  `record_check_run()` reads it.
- If a key may have leaked (pasted in a chat, committed by mistake), make a new one and repeat
  the steps. Old results stay valid.
