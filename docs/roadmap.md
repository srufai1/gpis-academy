# Roadmap — build tasks for the platform and the checker

Each task is small enough for one working session. Tasks are built in order unless "Needs"
says otherwise. Tasks marked **ARCHITECT** are designed and built with the architect; do not
start them from this file alone.

## Rules for whoever builds a task

1. Read first: `decisions.md`, `platform.md`, `checker.md`, the mockup named in the task, and
   `content/README.md`. Do not reopen decisions. If something needed is not written, stop and
   ask one short question.
2. Do only the task. No extra features, no refactoring of other tasks' files.
3. Security rules (same as GPIS): RLS on every table; role from `app_metadata`; no secret or
   service-role key anywhere under `src/`; every schema change is a new file in
   `supabase/migrations/`; validate on the client, the server and the database; in a Server
   Component call `getClaims()` before any query.
4. Interface: design for 360px first; touch targets at least 44px; one main button per
   screen; shadcn/ui and Lucide only; loading, empty and error states for every screen.
5. Never connect to a real database from a test. Database tests run on PGlite (in memory).
6. Before saying "done", run and paste the result of:

```bash
npm run lint
```

```bash
npx tsc --noEmit
```

```bash
npm run build
```

```bash
npm test
```

7. One commit per task: `T07: course map screen`. Report what was built, what was not, and
   anything noticed but not changed. Never claim a check passed unless you saw it pass.

## Overview

| Phase | Tasks | Result |
| :--- | :--- | :--- |
| 0 Foundation | T01–T04 | A repo that builds, signs in, and has a tested schema |
| 1 Content | T05–T06 | The sample unit is loaded and indexed |
| 2 Study screens | T07–T11 | Map, lesson, quiz, project task, progress (without checker results) |
| 3 Checker | T12–T17 | `academy` runs the sample check locally |
| 4 Results | T18–T21 | Signed results reach the platform and show on the task page |
| 5 Finish | T22–T24 | Self-review, quality pass, deployment |

**ARCHITECT tasks: T04, T12, T19.**

---

## Phase 0 — Foundation

### T01 — Repository skeleton and tooling
- **Goal.** An npm workspace that lints, type-checks, builds and runs an empty test suite.
- **Files.** `package.json` (workspaces `apps/*`, `packages/*`), `tsconfig.base.json`,
  `eslint.config.mjs`, `.gitignore`, `.env.example` (names only, no values), `AGENTS.md`
  (the rules above, plus pointers to `docs/`), `README.md`, `scripts/run-tests.mjs` (runs
  every `scripts/test-*.mjs|ts`, like GPIS), `packages/shared/` and `packages/checker/` as
  empty typed packages.
- **Accept.** The four commands in rule 6 pass on a fresh clone after `npm ci`. TypeScript is
  strict. No dependency is added that this task does not use.
- **Tests.** `scripts/test-repo-rules.mjs`: fails if `sb_secret_` or `service_role` appears
  under any `src/`, or if `.env.example` holds a value.

### T02 — Web app shell and landing page
- **Needs.** T01. **Mockup.** `01-landing.md`.
- **Goal.** `apps/web` runs; the landing page and the signed-in shell (top bar, bottom bar
  with Map · Progress · Me, sidebar from `md:`) exist with placeholder pages.
- **Files.** `apps/web/` (Next.js 16 App Router, Tailwind v4, shadcn/ui init),
  `src/app/(public)/page.tsx`, `src/app/(app)/layout.tsx`, `src/components/app-shell.tsx`,
  `src/config/site.ts` (the one place for the site name and texts).
- **Accept.** Landing matches the mockup's content and order. At 360px nothing scrolls
  sideways. Bottom bar targets are at least 44px. No site name is typed outside
  `site.ts`.
- **Tests.** `scripts/test-shell-browser.mjs` (Playwright, 360px): landing renders, main
  button visible, no sideways scroll, three bottom-bar links.

### T03 — Supabase wiring and sign-in
- **Needs.** T02.
- **Goal.** Sign up, sign in and sign out with email and password. Signed-out visitors
  reach only the public pages.
- **Files.** `supabase/config.toml`, `src/lib/supabase/{server,client,proxy}.ts`,
  `src/proxy.ts`, `src/app/(auth)/sign-in/`, `src/app/(auth)/sign-up/`,
  `src/lib/auth/request.ts` (cached `getClaims()` per render), sign-out in the Me page.
- **Accept.** A signed-out request to `/map` goes to `/sign-in`. A signed-in request to
  `/sign-in` goes to `/map`. Errors are plain sentences, never raw Supabase messages. Private
  pages are sent with `Cache-Control: private, no-store`.
- **Tests.** `scripts/test-auth-gate.mjs` (offline, with a fake client like GPIS's D-163
  harness): the four redirects; `getClaims()` is called once per render.

### T04 — Schema, RLS and immutable history — **ARCHITECT**
- **Needs.** T01.
- **Goal.** The eight tables of `platform.md` with RLS, grants, the immutability triggers,
  the sign-up trigger for `profiles`, and a PGlite test harness that later tasks reuse.
- **Why architect.** Every later task trusts this. A wrong grant or policy here is a silent
  hole, and `check_runs` must be closed in a way T19 can open correctly.
- **Files.** `supabase/migrations/0001_*.sql` …, `scripts/lib/pglite-schema.mjs`,
  `scripts/test-schema-rls.mjs`, `scripts/test-immutable-history.mjs`.
- **Accept.** Every table has RLS on. As learner A: own rows readable, learner B's rows
  never. `quiz_attempts`, `check_runs`, `reviews` refuse UPDATE and DELETE for every role.
  `check_runs` refuses a direct INSERT. Anonymous has no table privilege. Migrations replay
  from empty.

---

## Phase 1 — Content

### T05 — Content format and loader
- **Needs.** T01.
- **Goal.** Read a unit folder into typed data, and refuse a malformed one with a clear
  message.
- **Files.** `packages/shared/src/content-schema.ts` (types and validators for `unit.md`
  front matter, `quiz.json`, `check.yaml`), `apps/web/src/lib/content/load.ts`,
  `scripts/build-content.mjs` (writes `content/index.json` and `content/manifest.json`:
  each check's id, version and sha256 of its `check/` folder).
- **Accept.** The sample unit `content/module-01/unit-01` loads. A missing file, a quiz
  answer index out of range, a duplicate id, or a `check/` change without a version change
  each fail the build with the file name and the reason. Quiz answers and reasons are never
  included in anything sent to the browser before an attempt is marked.
- **Tests.** `scripts/test-content.mjs`: the sample unit passes; six broken copies each fail
  for the stated reason; the manifest hash is stable across two runs.

### T06 — Content index into the database
- **Needs.** T04, T05.
- **Goal.** A script the developer runs to publish `content_items` and `check_definitions`.
- **Files.** `scripts/publish-content.mjs` (reads `index.json` and `manifest.json`, writes
  with the database owner's connection from an environment variable; prints what it will
  change; `--apply` to write).
- **Accept.** Without `--apply` nothing is written. Running twice changes nothing the second
  time. A published check version is never changed or removed; a new version is added.
  The script lives outside `src/` and is never imported by the app.
- **Tests.** `scripts/test-publish-content.mjs` on PGlite: first run inserts, second is a
  no-op, a changed hash under the same version is refused.

---

## Phase 2 — Study screens

### T07 — Course map
- **Needs.** T03, T06. **Mockup.** `02-course-map.md`.
- **Goal.** The home page after sign-in: Continue row, then one raised row per module.
- **Files.** `src/app/(app)/map/page.tsx`, `src/app/(app)/map/[module]/page.tsx`,
  `src/lib/progress/summary.ts` (pure functions: next item, per-module counts).
- **Accept.** Continue points to the first unfinished item in course order. Nothing is
  locked. A module row opens its units and projects. Empty state for a new learner says
  "Start with Module 1" with one button.
- **Tests.** `scripts/test-progress-summary.mjs` (pure rules); `scripts/test-map-browser.mjs`
  (360px, offline data).

### T08 — Lesson page
- **Needs.** T07. **Mockup.** `03-lesson.md` (top half).
- **Goal.** Show `lesson.md` and `example.md` as safe HTML, and record "read".
- **Files.** `src/app/(app)/learn/[unit]/page.tsx`, `src/lib/content/markdown.ts`,
  `src/app/(app)/learn/[unit]/actions.ts` (mark as read).
- **Accept.** Markdown renders headings, tables, lists and code blocks. Raw HTML in a lesson
  is shown as text, never run. Code blocks scroll inside themselves at 360px. The Server
  Action checks the signed-in user and that the unit exists.
- **Tests.** `scripts/test-markdown.mjs` (a `<script>` in a lesson is escaped);
  `scripts/test-lesson-browser.mjs`.

### T09 — Quiz
- **Needs.** T08. **Mockup.** `03-lesson.md` (bottom half).
- **Goal.** Answer, get marked on the server, see the score and the reasons, try again.
- **Files.** `src/app/(app)/learn/[unit]/quiz.tsx`, `src/app/(app)/learn/[unit]/quiz-actions.ts`,
  `src/lib/quiz/mark.ts` (pure marking).
- **Accept.** The browser never receives the right answers before submitting. The score is
  computed in the Server Action and stored as a new `quiz_attempts` row with the content
  hash. Every attempt is kept. Passing sets the unit's quiz state.
- **Tests.** `scripts/test-quiz-mark.mjs` (pure); `scripts/test-quiz-db.mjs` on PGlite
  (attempt inserted, cannot be updated, another learner cannot read it).

### T10 — Project task page (without results)
- **Needs.** T08. **Mockup.** `04-project-task.md`.
- **Goal.** Show `lab.md`, `debugging-lab.md` and `own-build.md`; steps and hints by guidance
  level; the checker command with a Copy button.
- **Files.** `src/app/(app)/project/[id]/page.tsx`, `src/components/copy-command.tsx`.
- **Accept.** "Steps" shows only for guided projects; "Hints" for guided and half guided.
  Copy works by keyboard. The results area shows "No result yet. Run the command in your
  terminal."
- **Tests.** `scripts/test-task-browser.mjs` (360px; guidance rules for three sample levels).

### T11 — Progress page
- **Needs.** T07. **Mockup.** `05-progress.md`.
- **Goal.** Per project: done, checker, self-review, on time — four separate facts.
- **Files.** `src/app/(app)/progress/page.tsx`, `src/lib/progress/facts.ts` (pure; derives the
  four facts from attempts, runs and reviews).
- **Accept.** "Checker" is true only for a passing run of the **current** check version.
  "Review" is labelled as the learner's own. "–" means not yet, never zero. Until T20 the
  checker and review columns are derived from empty tables and show "–".
- **Tests.** `scripts/test-progress-facts.mjs` (pure, including an old-version pass).

---

## Phase 3 — Checker

### T12 — Result format and signing protocol — **ARCHITECT**
- **Needs.** T01.
- **Goal.** The exact wire format shared by the CLI and the platform: result schema,
  canonical JSON, Ed25519 signature, challenge and stamp formats, with test vectors.
- **Why architect.** If the two sides disagree by one byte, every signature fails; if the
  format leaves room for ambiguity, signatures can be reused. This is the security core.
- **Files.** `packages/shared/src/{result-schema,canonical,signing}.ts`,
  `docs/protocol.md`, `scripts/test-protocol-vectors.mjs`.
- **Accept.** Fixed test vectors verify in both directions; a changed byte, a reordered key,
  an expired or reused challenge, and a result for another check each fail.

### T13 — CLI skeleton
- **Needs.** T05.
- **Goal.** `academy doctor`, `academy init <id>`, `academy check <id> --dry-run` exist and
  print the output format of `checker.md`; step kinds are plug-ins that T14–T16 fill in.
- **Files.** `packages/checker/src/{cli,commands/*,runner,report}.ts`, `bin/academy`.
- **Accept.** `init` builds the lab folder from the check's seed and refuses to overwrite
  without `--reset`. `check` loads `check.yaml`, runs steps in order, prints one line per
  step and a summary, and exits 0 on pass, 1 on not passed, 2 on a checker error. An unknown
  step kind is an error, not a pass.
- **Tests.** `scripts/test-cli-runner.mjs` with fake step kinds.

### T14 — Step kinds: `files`, `doc`, `git`
- **Needs.** T13.
- **Goal.** The three kinds that only read the project.
- **Files.** `packages/checker/src/steps/{files,doc,git}.ts`.
- **Accept.** `files` supports `type` (file, directory, symlink, absent), `mode`,
  `mode_any_of`, `target`, `resolves`, `sha256_of`, `glob`. `doc` checks headings and minimum
  words. `git` checks commit count, message rules and that no listed secret pattern is in any
  commit. A path that leaves the project or lab folder is refused.
- **Tests.** `scripts/test-steps-files.mjs`: the sample check `m1-p1` fails on a fresh seed
  and passes on a solved copy; path-escape attempts are refused.

### T15 — Step kinds: `tests`, `static`
- **Needs.** T13.
- **Goal.** Run a command or the course's test files against the learner's code, with a
  time limit.
- **Files.** `packages/checker/src/steps/{tests,static}.ts`.
- **Accept.** Each run has a timeout and an output size limit. Exit code and output are
  compared as the check says. `static` runs lint, `tsc` and build when the project has them.
  Failure reasons are cut to a fixed length.
- **Tests.** `scripts/test-steps-run.mjs`: pass, fail, timeout, too much output.

### T16 — Step kinds: `sql`, `page`
- **Needs.** T13.
- **Goal.** Query the learner's lab database; open a local page at 360px.
- **Files.** `packages/checker/src/steps/{sql,page}.ts`.
- **Accept.** `sql` reads the connection from the project's `.env`, works only inside a
  scratch schema it creates and drops, and refuses when the lab-database guard fails (the
  guard is defined in `check.yaml`'s `requires`). `page` starts nothing itself: it opens the
  URL the check names and reports what a user would see. Both say clearly when their
  requirement (database, browser) is missing — a "needs" result, not a fail.
- **Tests.** `scripts/test-steps-sql.mjs` on PGlite; `scripts/test-steps-page.mjs` against a
  static test page.

### T17 — Packaging the CLI
- **Needs.** T14.
- **Goal.** A learner installs the checker in `gpis-rebuild` and runs `npx academy`.
- **Files.** `packages/checker/package.json` (bin `academy`; the published files include
  `content/**/check/`), `docs/checker-install.md`, `academy init` writes
  `.vscode/tasks.json`.
- **Accept.** From a packed tarball installed in an empty folder, `npx academy doctor` and
  `npx academy check m1-p1 --dry-run` work. Lessons and quiz answers are **not** in the
  package; only `check/` folders are.
- **Tests.** `scripts/test-pack.mjs`: lists the tarball; fails if any `lesson.md` or
  `quiz.json` is inside.
- **Owner decision needed first.** The npm package name (the plain name `academy` may be
  taken) and whether to publish to npm or install from a GitHub release.

---

## Phase 4 — Results

### T18 — CLI sign-in and device registration
- **Needs.** T04, T12, T13. **Read.** `decisions.md` ADR-7.
- **Goal.** `academy login` signs the CLI in as the learner with an email one-time code, then
  registers this machine as a device. `academy logout` ends that session.
- **Files.**
  - `packages/checker/src/commands/{login,logout}.ts`, `packages/checker/src/session.ts`
    (store, refresh, Bearer header), `packages/checker/src/device-key.ts`;
  - `apps/web/src/app/api/cli/config/route.ts` (public: Supabase URL and publishable key);
  - `apps/web/src/app/api/devices/route.ts` (POST, Bearer only: register this device);
  - `apps/web/src/lib/auth/bearer.ts` (a Supabase client from a Bearer token, no cookies;
    T19 reuses it), and the proxy exception for `/api/cli/*`, `/api/devices`,
    `/api/check-runs/*`;
  - `apps/web/src/app/(app)/me/devices/` (list devices, revoke; no approval step);
  - a migration for `register_device(public_key text, label text)`.
- **Accept.**
  - Login: email → Supabase sends a code (`shouldCreateUser: false`) → the learner types it
    → session. At most 3 tries per code. An unknown email gets the same message as a wrong
    code.
  - The session file and the private key are separate files, both mode 600, in the CLI's
    folder under the learner's home. Neither is ever printed or sent to the platform.
  - The CLI refreshes an expired access token, writes the new refresh token to disk before
    using it (temp file, then rename), and says "run `academy login` again" when refreshing
    fails.
  - `register_device()` is `SECURITY DEFINER`, `search_path = ''`, executable by
    `authenticated` only (not `public`, not `anon`); sets `user_id = auth.uid()`; accepts
    only `ed25519:` + 43 base64url characters (`isDevicePublicKey`); refuses a key already
    registered; refuses a 6th device that is not revoked; returns the device id.
  - `/api/devices` accepts only `Authorization: Bearer`; a request with only a browser
    cookie gets 401. Label is one line, at most 80 characters, checked on the CLI, the route
    and the database.
  - Revoke sets `revoked_at`; nothing is deleted. Logging in again on the same machine keeps
    the existing key and device when the device is still valid.
- **Tests.**
  - `scripts/test-device-register-db.mjs` (PGlite): own device created; signed-out caller
    refused; bad key, duplicate key and 6th device refused; another learner cannot see it.
  - `scripts/test-cli-login.mjs` (offline, fake Supabase Auth and fake platform): happy path;
    wrong code; expired code; refresh rotates and is saved; refresh failure asks to log in
    again; file modes are 600; no token appears in the CLI's output.
  - Update `scripts/test-schema-rls.mjs`: the list of functions now includes
    `register_device`; signed-out callers still run none.
- **Not in this task.** The owner's Supabase settings (email template shows `{{ .Token }}`,
  email codes enabled): written into the runbook by T24, done by the owner.

### T19 — Challenge, verification and recording — **ARCHITECT**
- **Needs.** T04, T12, T18. **Read.** `protocol.md` §8, `decisions.md` ADR-7.
- **Goal.** The two routes and the one database function through which a result enters:
  issue a challenge; verify stamp, device, signature, version and schema; call
  `record_check_run()`. Both routes take the learner from the CLI's Bearer token (the
  `bearer.ts` helper from T18), never from a cookie.
- **Why architect.** This is the only door into `check_runs`. It mixes a server-only key,
  a database-held key, replay protection and RLS; a mistake is either a lockout or a forgery
  path.
- **Files.** `src/app/api/check-runs/{challenge,route}.ts`, `src/lib/check-runs/verify.ts`,
  a migration for `record_check_run()` and its key table,
  `scripts/test-check-run-security.mjs`.
- **Accept.** Every case in "What this stops" of `checker.md` has a failing test: altered
  result, replayed nonce, other learner's device, revoked device, unpublished version, direct
  call of the function without the route's stamp. Also: no Bearer token, an expired token,
  and a cookie-only request each get 401.

### T20 — Send results and show them
- **Needs.** T19, T10, T11.
- **Goal.** `academy check` sends the signed result; the task page shows the last result and
  earlier ones; the progress page shows the checker fact.
- **Files.** `packages/checker/src/commands/{check,status}.ts` (send, `--dry-run`, offline
  message), `src/app/(app)/project/[id]/results.tsx`, `src/lib/check-runs/read.ts`.
- **Accept.** When the platform cannot be reached, the local result still prints and the CLI
  says the result was not recorded. The result card shows pass or fail per step, the reason,
  the commit and the check version. An old-version pass is shown as "passed an earlier
  version".
- **Tests.** `scripts/test-results-view-browser.mjs` (mockup 04 states: none, failed, passed,
  old version); `scripts/test-cli-send.mjs` (offline behaviour).

### T21 — Re-run on a commit
- **Needs.** T20.
- **Goal.** `academy check <id> --at <commit>` checks a past state without touching the
  working folder.
- **Files.** `packages/checker/src/commands/check-at.ts`.
- **Accept.** Uses a temporary Git worktree and removes it afterwards, also on failure.
  Uncommitted work is untouched. The result records the commit and "clean tree: yes".
- **Tests.** `scripts/test-check-at.mjs` on a temporary repository.

---

## Phase 5 — Finish

### T22 — Self-review
- **Needs.** T20.
- **Goal.** After a pass: the review checklist, the explanation and the GPIS comparison,
  saved as revisions.
- **Files.** `src/app/(app)/project/[id]/review/`, `src/lib/reviews/`.
- **Accept.** A save is a new `reviews` row; earlier revisions stay readable. The form is
  offered only after a passing run of the current version. The page says "Your own check,
  not a mentor's". Text is length-limited on the client, the server and the database.
- **Tests.** `scripts/test-reviews-db.mjs` (insert only, own rows only);
  `scripts/test-review-browser.mjs`.

### T23 — Quality pass on the five screens
- **Needs.** T22.
- **Goal.** Every screen meets the quality gates that apply (`decisions.md`, ADR-5).
- **Files.** `scripts/test-screens-browser.mjs`, fixes in the screens.
- **Accept.** At 360px: no sideways scroll, all targets at least 44px, one main button per
  screen. Keyboard reaches everything. Loading, empty and error states exist for every data
  page. Colour contrast passes AA. Each fix is listed in the report.
- **Tests.** The new browser test covers all five mockups in three states each.

### T24 — Deployment runbook
- **Needs.** T23.
- **Goal.** The owner can deploy to the Vercel free tier and a Supabase project by following
  one document.
- **Files.** `docs/runbook.md` (environment variable names, order of migrations, publish
  content, first sign-up, how to rotate the server key, how to restore).
- **Accept.** No secret value appears in the repo. The builder does **not** change Vercel or
  Supabase settings and does not apply migrations; the owner does, from the runbook. Function
  region is set next to the database region.
- **Tests.** `scripts/test-repo-rules.mjs` still passes; a fresh clone builds with only the
  placeholder variables from `.env.example`.

---

## After the roadmap

Not planned here: writing the lessons for modules 1–9 and the Python track. Each unit copies
the shape of `content/module-01/unit-01/` and adds its `check/` folder. The sample unit refers
to two more checks (`m1-p1-debug`, `m1-u1-own`) that still have to be written in that shape.
