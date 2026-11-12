# Decisions — GPIS Academy

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
