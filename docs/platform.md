# Platform — the minimal study tool

Read `decisions.md` and `curriculum.md` first. This is a plan; it contains no application code.

The platform is small on purpose (ADR-1, ADR-3). It shows the course, records what the learner
did, and receives results from the local checker (`checker.md`). It never runs learner code.

- **Stack:** Next.js 16 (App Router), TypeScript strict, Supabase (PostgreSQL, RLS, Auth),
  Tailwind CSS v4, shadcn/ui. Runs locally, then on the Vercel free tier.
- **Users:** one learner now. The data model already keeps each learner's rows separate, so a
  second learner needs no redesign.
- **Rules carried over from GPIS:** RLS on every table; role from `app_metadata`; no secret or
  service-role key in `src/`; every schema change is a migration; mobile-first at 360px with
  44px touch targets.

## System overview

```mermaid
flowchart LR
  subgraph PC["Learner's computer (WSL 2)"]
    VS["VS Code + terminal"]:::local
    REPO["gpis-rebuild repo"]:::local
    CLI["academy checker CLI"]:::local
  end
  subgraph CLOUD["Hosted (free tiers)"]
    WEB["Platform - Next.js on Vercel"]:::web
    DB[("Supabase: Postgres + RLS + Auth")]:::data
    LAB[("Learner's own Supabase lab project")]:::lab
  end
  GPIS["GPIS repo (read only)"]:::ref
  CONTENT["Course content + check files (this repo)"]:::ref

  VS --> REPO
  CLI -- "runs checks on" --> REPO
  CLI -- "sql checks" --> LAB
  CLI -- "signed result (no code)" --> WEB
  WEB --> DB
  CONTENT -- "built into" --> WEB
  CONTENT -- "shipped with" --> CLI
  REPO -. "compare with" .-> GPIS

  classDef local fill:#e8f1fb,stroke:#1f5fa8,color:#0b2545
  classDef web fill:#fff4cc,stroke:#b8860b,color:#3d2c00
  classDef data fill:#e6f4ea,stroke:#2e7d32,color:#0f3d17
  classDef lab fill:#f3e8fd,stroke:#6a1b9a,color:#2a0845
  classDef ref fill:#f1f1f1,stroke:#777,color:#222
```

## MVP features

| Feature | What the learner can do |
| :--- | :--- |
| Course map | See all modules in order, what is done, what is next, and the guidance level |
| Lessons | Read a lesson (Markdown from the repo), mark it read |
| Quizzes | Answer a short retrieval quiz; see the score; retry (every attempt is kept) |
| Project tasks | Read the task, the hints (if the level allows), and the exact checker command |
| Checker results | See each run sent by the CLI: pass or fail per check, with the reason |
| Self-review | Tick the review checklist and write the short explanation and GPIS comparison |
| Progress | Four separate facts per project: complete, correct (checker), reviewed (self), on time |
| Sign in | Email and password (Supabase Auth); connect the CLI to the account |

Course content is **files in this repo**, not database rows the learner edits:
`content/module-NN/unit-NN/` holding `lesson.md`, `quiz.json`, `lab.md` and the rest (the
template is `content/module-01/unit-01/`). A build step lists them into
`content_items` so that progress rows can point at something real.

## Learner journey

```mermaid
flowchart TD
  A["Open course map"]:::page --> B["Read lesson"]:::page
  B --> C["Guided example"]:::work
  C --> D{"Quiz passed?"}:::gate
  D -- no --> B
  D -- yes --> E["Lab + debugging lab"]:::work
  E --> F["Own build in gpis-rebuild"]:::work
  F --> G["Run checker in terminal"]:::cli
  G --> H{"All checks pass?"}:::gate
  H -- no --> F
  H -- yes --> I["Result appears on platform"]:::page
  I --> J["Self-review + compare with GPIS"]:::work
  J --> K["Mastery check"]:::gate
  K --> L["Next unit"]:::page

  classDef page fill:#fff4cc,stroke:#b8860b,color:#3d2c00
  classDef work fill:#e8f1fb,stroke:#1f5fa8,color:#0b2545
  classDef cli fill:#e6f4ea,stroke:#2e7d32,color:#0f3d17
  classDef gate fill:#fde8e8,stroke:#b3261e,color:#4a0d0a
```

## Data model (8 tables)

| Table | Purpose | Changes allowed |
| :--- | :--- | :--- |
| `profiles` | One row per learner (name, time zone) | Own row: read, update name |
| `content_items` | Index of modules, units and projects, built from the repo | Read only for learners; written by the content build |
| `progress` | Current state of one item for one learner (read, quiz passed, …) | Own rows: insert, update |
| `quiz_attempts` | One row per quiz attempt: answers, score, content version | **Insert only** |
| `devices` | A registered checker install: public key, name, revoked or not | Own rows: read, revoke |
| `check_definitions` | Published check versions: project, version, file hash | Read only |
| `check_runs` | One row per checker run received: results, commit, signature | **Insert only, through one function** |
| `reviews` | Self-review revisions: checklist, explanation, GPIS comparison | **Insert only** (a change is a new revision) |

```mermaid
erDiagram
  PROFILES ||--o{ PROGRESS : has
  PROFILES ||--o{ QUIZ_ATTEMPTS : makes
  PROFILES ||--o{ DEVICES : registers
  PROFILES ||--o{ CHECK_RUNS : owns
  PROFILES ||--o{ REVIEWS : writes
  CONTENT_ITEMS ||--o{ PROGRESS : tracks
  CONTENT_ITEMS ||--o{ QUIZ_ATTEMPTS : for
  CONTENT_ITEMS ||--o{ CHECK_DEFINITIONS : checked_by
  CONTENT_ITEMS ||--o{ REVIEWS : about
  CHECK_DEFINITIONS ||--o{ CHECK_RUNS : version_used
  DEVICES ||--o{ CHECK_RUNS : signed_by

  PROFILES {
    uuid id PK
    text full_name
    text time_zone
  }
  CONTENT_ITEMS {
    text slug PK
    text kind "module, lesson, quiz, project"
    text parent_slug
    int position
    text guidance "guided, half, independent"
    text content_hash
  }
  PROGRESS {
    uuid user_id FK
    text item_slug FK
    text state
    timestamptz due_on
    timestamptz updated_at
  }
  QUIZ_ATTEMPTS {
    bigint id PK
    uuid user_id FK
    text item_slug FK
    jsonb answers
    int score
    text content_hash
    timestamptz created_at
  }
  DEVICES {
    uuid id PK
    uuid user_id FK
    text public_key
    text label
    timestamptz revoked_at
  }
  CHECK_DEFINITIONS {
    bigint id PK
    text item_slug FK
    text version
    text sha256
    timestamptz published_at
  }
  CHECK_RUNS {
    bigint id PK
    uuid user_id FK
    uuid device_id FK
    bigint definition_id FK
    text nonce UK
    text commit_sha
    bool passed
    jsonb results
    text signature
    timestamptz created_at
  }
  REVIEWS {
    bigint id PK
    uuid user_id FK
    text item_slug FK
    int revision
    jsonb checklist
    text explanation
    text gpis_comparison
    timestamptz created_at
  }
```

### Row-Level Security

RLS is on for every table, with no policy until one is written (deny by default).

| Table | Select | Insert | Update | Delete |
| :--- | :--- | :--- | :--- | :--- |
| `profiles` | own row | by a sign-up trigger | own row | never |
| `content_items` | any signed-in user | never (content build only) | never | never |
| `progress` | own rows | own rows | own rows | never |
| `quiz_attempts` | own rows | own rows; score is computed by the server | never | never |
| `devices` | own rows | by the device-registration function | own rows: set `revoked_at` only | never |
| `check_definitions` | any signed-in user | never (content build only) | never | never |
| `check_runs` | own rows | **no policy**; only `record_check_run()` inserts | never | never |
| `reviews` | own rows | own rows | never | never |

"Own" always means `user_id = auth.uid()`. The content build runs as a migration-style script
with the database owner's connection, from the developer's machine or CI, never from `src/`.

### Immutable attempts

`quiz_attempts`, `check_runs` and `reviews` are history. Three layers keep them unchanged:

1. **Privileges:** `UPDATE` and `DELETE` are not granted to `authenticated` on these tables.
2. **Policies:** there is no update or delete policy.
3. **Trigger:** a `BEFORE UPDATE OR DELETE` trigger raises an error for every role, so a later
   mistake in grants cannot open them.

A quiz score is never sent by the browser. A Server Action reads the answers, marks them
against `quiz.json` on the server, and inserts the attempt with the score.

`progress.state` for a project is **derived** when it is read: "correct" means a passing
`check_runs` row exists for the current check version; "reviewed" means a `reviews` row
exists. The learner cannot set those two by hand.

## Folder structure

```text
gpis-academy/
  docs/                    decisions, curriculum, platform, checker, mockups
  content/                 the course (original lessons only); see content/README.md
    module-01/
      unit-01/             unit.md  lesson.md  example.md  quiz.json  lab.md
                           debugging-lab.md  own-build.md  review.md
        check/             check.yaml  fixtures/   (the lab's check; see checker.md)
    index.json             built: every module, unit and project
    manifest.json          built: version and hash of every check
  packages/
    checker/               the CLI (Node/TypeScript), published as `academy`
    shared/                types and result schema used by CLI and platform
  apps/
    web/                   the platform
      src/app/             (public) landing · (auth) sign in · (app) map, lesson, project, progress
      src/app/api/         check-runs, device registration
      src/components/      shadcn/ui components and screen parts
      src/lib/             content loader, progress rules, signature checks
  supabase/
    migrations/            every schema change
  scripts/                 content build, offline tests
```

## Not in the MVP

| Left out | Why |
| :--- | :--- |
| Hosted terminals, sandboxes, in-browser editor | ADR-3; the learner's own terminal and VS Code |
| AI tutor, chat, RAG | ADR-3 |
| Cohorts, teams, mentors, review queues, peer review | One learner; self-review only (ADR-5) |
| Admin screens and a content editor | Content is files in the repo, changed with Git |
| Payments, certificates, badges, leaderboards | Not needed to learn |
| Analytics dashboards, weekly reports, recommendations | One progress page is enough |
| Portfolio or blog generator | The learner builds their own site (project 3.1) |
| Mobile app, offline mode, push or email notices | A responsive site is enough |
| Background jobs, queues, caches | Nothing here is slow enough to need them |
| Discussion, comments, notes | Out of scope for a study tool |
| Running or storing the learner's code | The platform stores results only, never code |
