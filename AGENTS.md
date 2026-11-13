# AGENTS.md

Rules for any AI agent (or person) building Ruftech Academy. This file is the single source of
agent rules. `CLAUDE.md` only points here.

## Read first

1. `docs/decisions.md` — the decisions (ADR-1 to ADR-8). Do not reopen them.
2. `docs/platform.md` and `docs/checker.md` — what is being built.
3. `docs/roadmap.md` — the numbered tasks. Build one task at a time.
4. The mockup named in the task (`docs/mockups/`), and `content/README.md` for course files.

If something you need is not written down, stop and ask one short question.
`docs/blueprint-v2.md` is background only; where it disagrees with `docs/decisions.md`,
the decisions win.

## Rules

1. Do only the task. No extra features, no refactoring of other tasks' files.
2. Security (same as GPIS):
   - RLS on every table; role from `app_metadata`, never `user_metadata`.
   - No secret or service-role key anywhere under `src/` (`npm test` fails if one appears).
   - Every schema change is a new file in `supabase/migrations/`.
   - Validate on the client, the server and the database.
   - In a Server Component, get the claims (`src/lib/auth/request.ts`) before any query.
3. Interface: design for 360px first; touch targets at least 44px; one main button per
   screen; shadcn/ui and Lucide only; loading, empty and error states for every screen.
   Site name and fixed texts live in `apps/web/src/config/site.ts` only.
4. Never connect to a real database from a test. Database tests run on PGlite (in memory).
5. Before saying "done", run these and report the result:
   `npm run lint` · `npx tsc --noEmit` · `npm run build` · `npm test`
   (browser tests: `npm test -- --with-browser`, after `npm run build`).
6. One commit per task, named like `T07: course map screen`. Report what was built, what was
   not, and anything noticed but not changed. Never claim a check passed unless you saw it.
7. Write for the owner in short, plain English. No model names in commits.
