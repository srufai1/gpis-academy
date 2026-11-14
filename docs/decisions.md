# Decisions — Ruftech Academy

Short decision records (ADRs) for the course and its small study platform.
They apply on top of `blueprint-v2.md`. Where the two differ, **this file wins**.

Date of all decisions: 12 November 2026. Decided by: the owner (first learner).

---

## ADR-1 — The course rebuilds GPIS; the platform stays small

**Decision.** The course teaches software engineering by rebuilding GPIS (the school
management system in `srufai1/gpis-school-system`) step by step. GPIS is the reference answer
at every step. The e-learning platform is only the tool the learner studies with.

**Why.** GPIS is a real, working system with real rules (grading, ranking, class membership,
fees, issued documents). A learner who can rebuild it has met real problems, not toy ones.

**Consequences.**
- Every module names the part of GPIS it rebuilds, and ends with "compare with GPIS".
- The learner builds in their own repository (`gpis-rebuild`). `gpis-school-system` is read
  only: never edited, never copied in bulk.
- The platform gets only what studying needs: lessons, quizzes, progress, checklists.
- The blueprint idea "learners build the e-learning platform through the program" is dropped.

## ADR-2 — Next.js/TypeScript first; Python is a separate track at the end

**Decision.** The main course uses the GPIS stack: Next.js 16 (App Router), TypeScript strict,
Supabase (PostgreSQL, Row-Level Security, Auth), Tailwind CSS v4, shadcn/ui, Vercel. Python
comes after the capstone as its own track, which adds a Python (FastAPI) service to GPIS.

**Why.** One stack end to end means every lesson can be compared with real GPIS code. Two
languages at once slows a single learner down.

**Consequences.**
- Blueprint Module 3 (Python core and backend) moves to the end and becomes the Python track.
- Backend work in the main course is done in Next.js (Server Actions, route handlers) and in
  PostgreSQL (constraints, functions, RLS), as GPIS does.
- Bash stays a tool for terminal skill only; real automation is TypeScript, later Python.

## ADR-3 — One learner, local first, no hosted execution

**Decision.** One learner at first (the owner). The platform runs locally, then on the Vercel
free tier. There are **no** hosted terminals, sandboxes, VMs, Redis, Celery, Expo app, AI tutor,
or mentor/team queues for now. The learner uses their own PowerShell or WSL terminal and
VS Code. Work is checked by a **local checker CLI**.

**Why.** Hosted code execution is the most expensive and most dangerous part of the blueprint.
One learner does not need it. A local checker gives the same feedback at no cost.

**Consequences.**
- Labs run on the learner's machine in **WSL 2 (Ubuntu), required from Module 1**.
- Database labs use the learner's own **free Supabase cloud project** by default. Docker
  Desktop is optional and only for labs that truly need it (replication and restore,
  containers); `curriculum.md` marks them **[Docker]**. (Amended 12 Nov 2026.)
- The checker runs in the learner's project folder. It can: run a test suite shipped with the
  course, run lint and type checks, read the Git history, run SQL against the learner's lab
  database, and open a page in a local browser at 360px wide.
- The checker reports pass / fail with the reason. It never uploads code.
- A "pass" from the checker is practical evidence only. The written explanation and the
  comparison with GPIS are self-assessed and labelled as such (see ADR-5).

## ADR-4 — Guidance fades: guided, half guided, independent

**Decision.**

| Level | Where | What the learner gets |
| :--- | :--- | :--- |
| Guided | Early modules | Step-by-step instructions; compare with GPIS code after each step |
| Half guided | Middle modules | The task, hints, and the checker; no steps |
| Independent | Late modules and capstone | Requirements only; compare with GPIS at the end |

**Why.** Copying steps does not build skill. Removing help slowly does.

**Consequences.**
- Each module in `curriculum.md` states its level.
- In independent work, GPIS code is opened only after the learner's own version passes the
  checker (or after a real, written attempt has failed).

## ADR-5 — What is kept from the blueprint

**Decision.** Keep these parts, adapted to one self-study learner:

1. **Unit format** (blueprint §7): lesson → guided example → quiz → lab → debugging lab →
   own build → review → mastery check.
2. **Practical labs table** (§12.2): all labs stay, placed in the new module order. The
   Python-based labs (API consumer, structured log report) move to the Python track.
3. **Five project stages** (§12.6) as **self-study checklists**: proposal, MVP specification,
   implementation plan, build and review, release and defence. No reviewer queue.
4. **Quality gates** (§10): a feature is done only when the gates that apply are met.
5. **Learning discipline** (§11): model, threat model, test plan, reflection before merging;
   AI is used to critique and explain, not to skip the work.
6. **Source policy** (§12.9): original lessons only. ALX pages are never copied, uploaded,
   published, or fed to any tool.

**Consequences.**
- "Review" in the unit format means self-review against a checklist plus comparison with
  GPIS. It is labelled self-assessed; it does not claim a mentor checked it.
- Results show four separate things: complete, correct (checker), reviewed (self), on time.

## ADR-6 — Two additions: System Design module and a portfolio site

**Decision.**
- Add a **System Design** module after Databases and before Security/DevOps. Case study:
  "GPIS for 50 schools" — caching, queues, scaling reads, multi-tenancy trade-offs, rate
  limits, capacity estimates.
- Add a **personal portfolio site** project in the Frontend module.

**Why.** GPIS is a single-school system on purpose, so it never forces scaling questions.
A design case study teaches them without changing GPIS. The portfolio site gives the learner a
public result early.

**Consequences.**
- System Design produces documents, diagrams, numbers and small local experiments. It does
  **not** add multi-tenancy, Redis or queues to the rebuilt GPIS.
- The portfolio site is the learner's own design, deployed on the Vercel free tier.

---

## ADR-7 — The CLI signs in as the learner (email code); the device key only signs results

Date: 13 November 2026.

**Problem.** The check-run routes accept only a signed-in learner (`protocol.md` §8, step 1),
but the `academy` CLI runs in a terminal and has no session. The first plan for T18 (a code
approved in the browser) gave the CLI a device key, not a session. The app holds no secret key
to make a session, and signed-out callers can run no database function (T04).

**Decision.** `academy login` signs the CLI in **as the learner**, with a one-time code sent
by email and typed into the terminal (Supabase Auth email OTP). The CLI keeps its own session
and sends the access token as `Authorization: Bearer` to the platform. The device key stays,
with one job: sign results.

| Question | Answered by |
| :--- | :--- |
| Who is calling? | The session (access token), checked with `getClaims()` |
| Which install sent this result, and was it changed? | The device key (Ed25519 signature) |

**Why this one.**
- It keeps every rule already built and tested: RLS as it is, `user_id = auth.uid()` in every
  function, signed-out callers reach nothing, no secret key in the app.
- It needs no new table and no approval-code machinery; T18 gets smaller.
- It uses Supabase Auth as it is meant to be used; nothing home-made stands in for a login.

**Rejected.**
- *Browser approval code, CLI never signs in (option B).* Needs database functions that a
  signed-out caller can run, guarded only by a route stamp; a table of pending codes; and the
  learner's id passed as a parameter instead of `auth.uid()`. That moves all trust onto one
  HMAC key and breaks the T04 rule that signed-out callers run no function.
- *Hand the browser's session to the CLI.* Supabase refresh tokens are single-use; two clients
  sharing one session log each other out.
- *Type the account password into the CLI.* Works without email, but teaches a bad habit and
  stops working the day sign-in is no longer by password.

**Consequences.**
- `academy login`: ask for the email → Supabase sends a code → the learner types it → the CLI
  holds a session → it makes the device key pair → it registers the public key through
  `register_device()`. No browser step. The code never creates an account
  (`shouldCreateUser: false`); the learner signs up on the platform first.
- `register_device(public_key, label)` is `SECURITY DEFINER`, `search_path = ''`, executable
  by `authenticated` only, sets `user_id = auth.uid()`, checks the key format, and limits a
  learner to 5 devices that are not revoked.
- The CLI stores two secrets in the learner's home folder, both with file mode 600: the device
  private key and the session (refresh token). It refreshes the access token when needed and
  saves the new refresh token before using it. If refreshing fails it says "run
  `academy login` again".
- The CLI routes (`/api/devices`, `/api/check-runs/*`) accept **only** a Bearer token, never
  the browser cookie, so a web page cannot trigger them. The proxy lets them through; each
  route answers 401 itself.
- The CLI learns the Supabase URL and publishable key (both public) from the platform
  (`GET /api/cli/config`). It talks to Supabase Auth directly only to sign in and to refresh;
  everything else goes through the platform's routes.
- `protocol.md` v1 does not change: same payload, same signature, same stamps. §8 step 1 now
  says how the learner is known.
- **Owner setup (runbook, T24):** the Supabase "Magic Link" email template must show
  `{{ .Token }}`; email one-time codes must be enabled. The built-in email sender is limited
  (a few emails an hour, project members only), which is enough for one learner; a custom SMTP
  sender is needed before a second learner.
- Revoking a device stops its results but does not end the CLI's session. `academy logout`
  ends the session on that machine; "sign out everywhere" on the platform ends all of them.

## ADR-8 — The product is named Ruftech Academy

Date: 13 November 2026. Decided by the owner.

**Decision.** "GPIS Academy" becomes **Ruftech Academy** everywhere: the site name, the
emails, the docs, the npm packages (`@ruftech-academy/shared`, `/checker`, `/web`), the
checker tarball (`ruftech-academy-checker-<version>.tgz`), the repository
(`srufai1/ruftech-academy`), and the three context lines of the signing format
(`ruftech-academy/check-result/v1`, `ruftech-academy/challenge/v1`,
`ruftech-academy/record/v1`). The course still rebuilds GPIS (ADR-1); "GPIS" stays wherever
it means the school system the learner builds.

**Why now.** No result has been signed or recorded yet (T19 is not built), so changing the
context lines costs nothing: there is no old signature to keep valid. Later it would mean two
protocol versions.

**Consequences.**
- `protocol.md` keeps version `v1`; only the context text changed. The challenge stamp, the
  signature and the record stamp in §9 were recomputed with plain `node:crypto`, independently
  of `signing.ts`, and both agree. Keys, payload and its SHA-256 are unchanged.
- The lab database marker is now `purpose = 'ruftech-academy lab'`.
- Owner steps: rename the GitHub repository; optionally rename the Supabase project. GitHub
  redirects the old address, so nothing breaks in between.

## Blueprint sections cut or postponed

"Cut" = not planned. "Postponed" = may return when there is more than one learner.

| Blueprint section | Status | Reason |
| :--- | :--- | :--- |
| §1 Executive architectural decision (large platform) | Replaced | ADR-1: the platform is a small study tool |
| §2 GPIS repository analysis | Kept as background | Still true; the course now reads GPIS directly |
| §3.1 Product modes (cohort, assessed, team) | Postponed | One learner (ADR-3) |
| §3.2 Bounded contexts | Cut down | Only content, progress and checklists remain |
| §4 System architecture, §4.1 monorepo, §4.2 deployment boundaries | Cut | No API service, workers or mobile app; one Next.js app |
| §4.3 API rules | Postponed | No public API yet; reused as lesson material in the backend module |
| §5.1 Identity | Cut down | One user; Supabase Auth is enough |
| §5.2 Curriculum and publication | Cut down | Lessons are Markdown files in the repo; no publishing workflow |
| §5.3 Enrollment and schedules | Cut | One learner, one course |
| §5.4 Progress and attempts | Kept, small | Unit progress, quiz results, checker results |
| §5.5 Mastery and analytics | Postponed | A simple progress page is enough |
| §5.6 AI and RAG | Cut | No AI tutor (ADR-3) |
| §5.7 Portfolio and publishing | Cut | The portfolio is the learner's own site (ADR-6) |
| §5.8 Constraints and indexes | Cut down | Follows the smaller data model |
| §6.1 Dashboard and catalog | Cut down | One course: a module list and "continue" |
| §6.2 Interactive Learning Studio | Cut | No in-browser editor or terminal; own VS Code and terminal |
| §6.3 Analytics and weekly reporting hub | Postponed | A weekly self-report checklist replaces it |
| §6.4 Portfolio and blog generator | Cut | Learner writes their own site and articles |
| §7 Module 3 Python core and backend | Moved | Becomes the Python track at the end (ADR-2) |
| §7 Module 8 Generative AI and prompt engineering | Postponed | Not needed to rebuild GPIS |
| §7 "learners build the e-learning platform" | Replaced | Learners rebuild GPIS (ADR-1) |
| §8 Execution roadmap, phases 4–9 (exercise engine, cohorts, analytics, AI tutor, publishing, mobile) | Cut / postponed | All depend on things ADR-3 removes |
| §9 First four sprints | Replaced | A new, smaller plan will follow these decisions |
| §10 Initial service objectives (99.9%, queue times, AI evals) | Cut | No public service; the quality gates themselves stay |
| §12.3 Learning Studio: four exercise modes | Cut | Replaced by local labs and the checker CLI |
| §12.4 Lab architecture and trust boundaries | Cut | No hosted labs, so no sandbox to secure |
| §12.5 Schema extensions and invariants | Cut | Belonged to hosted labs and reviews |
| §12.6 Mentor queue and reviewer assignment | Postponed | Self-study checklists only (ADR-5) |
| §12.7 Analytics and portfolio changes | Postponed | Same reason as §5.5 and §6.4 |
| §12.8 Revised delivery gates | Replaced | The checker and the module mastery checks are the gates |
| Hosted terminals, sandboxes, VMs | Cut | Cost and risk; local terminal instead (ADR-3) |
| Redis, Celery / background workers | Cut | Nothing in a one-learner tool needs them |
| Expo mobile app, offline sync | Cut | The site is responsive; that is enough |
| Team projects, peer review | Postponed | One learner |

## Known limits (accepted for now)

| Limit | Why it is accepted | When to fix |
| :--- | :--- | :--- |
| A learner can insert their own `quiz_attempts` row with any score by calling the database directly (the table allows inserting own rows). | One learner; it only cheats themselves. The app always marks on the server. | Before selling the course, or before quiz scores count towards anything: mark quizzes in a database function with the answers stored server-side, the same kind of single door as `check_runs`. |
| A learner can save a self-review without a passing run by calling the database directly; only the page and the save action check for a pass (T22). | The review is self-assessed and only for the learner; a review without a pass cheats nobody else. The Progress page still shows the checker fact separately. | If reviews ever count towards anything: save them through a database function that checks for a passing run of the current version. |
| The local checker cannot prove the checks really ran (the learner controls the machine). | See `checker.md`; the signature proves which device sent a result. | When selling: the server re-runs checks for important projects. |
| The CLI's session has the same rights as the learner in the browser (it is the learner's own session), and its refresh token is a file on the learner's machine. | One learner, their own machine; the file is mode 600, like the device key. See ADR-7. | When selling, or if the CLI ever runs on shared machines: give the CLI a narrower token (only "send results"). |
