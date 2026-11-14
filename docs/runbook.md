# Runbook — putting Ruftech Academy online

Follow this top to bottom. **You** do every step: an agent never changes Vercel or Supabase
settings, never applies migrations, and never sees a secret value. Secrets go only into the
Vercel and Supabase dashboards, or your own terminal — never into a file in the repo, a chat or
a saved SQL snippet.

The site runs on **Vercel** (free plan), the database and sign-in on **Supabase** (project
`gpis-academy`, region London, eu-west-2). The app's server functions run in Vercel's London
region (`lhr1`), set in `apps/web/vercel.json`, so every page talks to a database in the same city.

---

## 1. The settings (environment variables)

| Name | Secret? | Where it comes from |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | No (public) | Supabase → Project Settings → API → Project URL. Looks like `https://abcd1234.supabase.co`, nothing after `.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | No (public) | Supabase → Project Settings → API Keys → publishable key (`sb_publishable_…`) |
| `ACADEMY_CHALLENGE_KEY` | **Yes** | You make it: `openssl rand -hex 32` |
| `ACADEMY_RECORD_KEY` | **Yes** | You make it: `openssl rand -hex 32` (a second, different one). Also stored in the database (step 3) |

The two `ACADEMY_…` keys must **never** get the `NEXT_PUBLIC_` prefix: that prefix sends a value
to every visitor's browser. `.env.example` lists the names; it never holds values.

For your own computer the same four lines go in `apps/web/.env.local` (never committed).

---

## 2. Database: migrations, in order

In Supabase → SQL Editor, run each file **whole**, in this order. Each one only once.

| # | File | What it adds |
| :--- | :--- | :--- |
| 1 | `supabase/migrations/0001_profiles.sql` | Profiles, roles from `app_metadata` |
| 2 | `supabase/migrations/0002_content.sql` | Course items and published checks |
| 3 | `supabase/migrations/0003_progress_quiz_reviews.sql` | Progress, quiz attempts, self-reviews |
| 4 | `supabase/migrations/0004_devices_check_runs.sql` | Devices and check results |
| 5 | `supabase/migrations/0005_immutable_history.sql` | History cannot be changed or deleted |
| 6 | `supabase/migrations/0006_register_device.sql` | `register_device()` for `academy login` |
| 7 | `supabase/migrations/0007_record_check_run.sql` | `record_check_run()` and the private key table |

> On the current project (`gpis-academy`) all seven are **already applied** (checked
> 13 November 2026). Run them only for a new project. A future migration `0008_…` is run the
> same way, after testing it on your computer.

**Check:** in the SQL Editor —

```sql
select count(*) as tables from pg_tables where schemaname = 'public';
```

Expected: `8`.

---

## 3. Database: the record key

Exactly as in `docs/runbook-check-runs.md`, steps 2, 4 and 5: make the two keys, then store the
**record** key in the database. Already done on the current project; check with:

```sql
select name, octet_length(key) as bytes from private.server_keys;
```

Expected: one row, `record`, `32`.

---

## 4. Publish the lessons

The site reads lesson text from the repo; the database needs the list of items and the
published checks. In your WSL terminal, in the project folder:

```bash
npm run content
export ACADEMY_DATABASE_URL='<connection string>'   # Supabase → Connect → Session pooler; paste your password in it
node scripts/publish-content.mjs            # shows what would change; changes nothing
node scripts/publish-content.mjs --apply    # writes it
unset ACADEMY_DATABASE_URL
```

The connection string holds the database password: type it only in your terminal, and `unset`
it afterwards. Repeat this whenever a lesson or check changes. A changed check gets a new
version; old results stay and show as "an earlier version".

---

## 5. Supabase sign-in settings

Supabase → Authentication:

1. **URL Configuration → Site URL:** your Vercel address, e.g. `https://ruftech-academy.vercel.app`
   (you get it in step 6; come back and set it). Confirmation emails open this address.
2. **URL Configuration → Redirect URLs:** add your Vercel address and `http://localhost:3000`.
3. **Emails → SMTP:** your own sender (done: Gmail with an app password). Without it Supabase's
   built-in sender is limited and the templates cannot be edited.
4. **Emails → Templates → Magic Link:** shows `{{ .Token }}` (done). This is the code
   `academy login` asks for.
5. **Sign In / Providers → Email:** email sign-in on; email OTP expiry `600` seconds.
6. **After your own account exists (step 7):** turn **off** "Allow new users to sign up".
   The site is public; with sign-up on, anyone could make an account. Turn it on again only
   when you want a second learner.

---

## 6. Vercel: create the project

1. vercel.com → **Add New → Project** → import `srufai1/ruftech-academy`.
2. **Root Directory:** `apps/web`. Framework: **Next.js** (found by itself). Leave the build
   and install commands as they are; Vercel installs the whole npm workspace.
3. **Environment Variables:** add the four names from step 1 with their values, for
   **Production** (and Preview if you use preview links).
4. **Deploy.** When it finishes, open the address it gives you.
5. Go back to step 5.1 and 5.2 and set that address.

**Check:** Project → Settings → Functions → region shows **London (lhr1)**. If it does not, the
`vercel.json` in `apps/web` was not read: check that Root Directory is `apps/web`.

Every push to `main` deploys again by itself.

---

## 7. First sign-in

- **Existing account** (`greatpakyiman20@gmail.com`): open the site → **Sign in**. Nothing else
  to do: accounts live in Supabase, not in Vercel.
- **New project:** open the site → **Create an account** → open the confirmation email → the link
  opens the site → **Sign in**. Then do step 5.6.

Then the checker, on your computer (see `docs/checker-install.md`):

```bash
npx academy login --url=https://<your vercel address>
npx academy check m1-p1
```

The last line should say `recorded on the platform`, and project 1.1 on the site shows it.
A device registered against `http://localhost:3000` is a different platform: logging in with
the new `--url` registers this computer again (revoke the old one under Me → Devices if you like).

---

## 8. Smoke test after every deploy

Open, signed in, on your phone: **Map** → a **lesson** (text shows) → its **quiz** (it marks) →
the **project** (Last result shows) → **Progress** → **Me → Devices**. If a lesson page fails
while the map works, the lesson files were not included in the deployment: tell the developer.

---

## 9. When something goes wrong

| What you see | Most likely cause | Fix |
| :--- | :--- | :--- |
| "Sign-in is not set up yet." | The two `NEXT_PUBLIC_…` settings are missing or wrong on Vercel | Fix them, then **Redeploy** (public settings are built into the site) |
| Sign-in says "Something went wrong" | Wrong publishable key (Supabase answers 401) | Copy it again from Supabase, redeploy |
| CLI: "not set up to receive results yet" (503) | An `ACADEMY_…` key missing, malformed, or both equal | Fix on Vercel, redeploy |
| CLI: "could not be recorded" (500) | No record key in the database | Step 3 |
| CLI: "not accepted" (403) every time | Record key on Vercel ≠ the one in the database | Set the same key in both (runbook-check-runs, "Changing a key") |
| The confirmation email opens `localhost` | Site URL not set | Step 5.1 |
| The site is very slow after a quiet week | Free Supabase projects pause when unused | Supabase dashboard → **Restore project**; wait a few minutes |

---

## 10. Changing a secret (rotation)

Do it at once if a secret was pasted in a chat, committed, or shown on screen to someone.

| Secret | How |
| :--- | :--- |
| `ACADEMY_CHALLENGE_KEY` | New `openssl rand -hex 32` → Vercel setting → Redeploy. Checks started before that fail once; run them again |
| `ACADEMY_RECORD_KEY` | New key → Vercel setting **and** step 3's `insert … on conflict` in the SQL Editor, close together → Redeploy. Recorded results stay valid |
| Database password | Supabase → Project Settings → Database → Reset password. Only `publish-content` uses it |
| Gmail app password | Google Account → App passwords → delete the old one, make a new one → Supabase → Emails → SMTP |
| Your account password | Change it. Then, on each computer, `npx academy logout` and `npx academy login` again, so no old CLI session stays |
| A lost or stolen computer | Site → **Me → Devices → Revoke**. Its results are refused from then on |

The publishable key is public by design; it does not need rotating.

---

## 11. Backups and restore

**Keep your own copy.** Check Supabase → Database → **Backups** for what your plan includes; on
the free plan, do not rely on it. Once a week (and before any new migration), in WSL:

```bash
export ACADEMY_DATABASE_URL='<connection string>'
pg_dump "$ACADEMY_DATABASE_URL" --schema=public --schema=private --format=custom --file="academy-$(date +%F).dump"
unset ACADEMY_DATABASE_URL
```

`pg_dump` must be version **17 or newer** (the database is PostgreSQL 17); `pg_dump --version`
shows yours. Ubuntu's own package is often older. The official PostgreSQL packages give 17:

```bash
sudo apt install -y postgresql-common
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh
sudo apt install -y postgresql-client-17
```

The dump holds your results, reviews and the record key: keep it outside the repo, on your own
disk or a private drive.

**Restore** is rare and is not a one-line command here: the history tables refuse changes on
purpose, and accounts (`auth.users`) are not in this dump. If you ever need it, keep the dump
safe, stop, and ask the developer for a restore script made for that case. Do not try to fix
data by hand in the SQL Editor.

**Lessons** never need a backup: they live in the repo. Re-run step 4.

---

## What this runbook does not cover

- A custom domain (Vercel → Domains) — optional; after adding one, repeat step 5.1–5.2.
- Paid plans, more learners, or a mentor role (decisions.md lists them as postponed).
