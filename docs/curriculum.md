# Curriculum — rebuild GPIS, step by step

Read `decisions.md` first. This file lists the modules in order.

## How the course works

- **You build** your own repository, `gpis-rebuild`. **GPIS** (`srufai1/gpis-school-system`)
  is the reference answer. You read it; you never edit it or copy it in bulk.
- **Stack:** Next.js 16 (App Router), TypeScript strict, Supabase (PostgreSQL, RLS, Auth),
  Tailwind CSS v4, shadcn/ui, Vercel. Python comes last, as its own track.
- **Tools:** your own PowerShell or WSL terminal, VS Code, Git, Node.js, Docker Desktop
  (for local PostgreSQL / local Supabase). Nothing is hosted for you.
- **Pace:** 12–15 focused hours a week. Main course about 60 weeks; Python track 8 weeks.
- **Every unit** follows the same eight steps: lesson → guided example → quiz → lab →
  debugging lab → own build → review → mastery check.
- **Every project** ends with: checker passes, then a short written explanation, then
  "compare with GPIS" (what GPIS does differently, and why).

## The local checker

A small command-line tool you run in your project folder. It works offline and uploads nothing.

```bash
npx academy check m2-p1
```

What it can do:

| Check | Meaning |
| :--- | :--- |
| `files` | Required files exist; forbidden things are absent (for example a secret key in `src/`) |
| `tests` | Runs a test suite that ships with the course against your code |
| `static` | Runs `eslint`, `tsc --noEmit`, `next build` |
| `git` | Reads your history: branches, commit messages, no secrets committed |
| `sql` | Runs queries against your local database and compares results |
| `page` | Opens a local page in a browser at 360px and checks what a user would see |
| `doc` | A written file exists and has the required headings (it does not judge the text) |

The checker proves behaviour. It cannot prove understanding: the written explanation and the
GPIS comparison are **self-assessed** and are shown as such.

## Guidance levels

| Level | Modules | You get |
| :--- | :--- | :--- |
| Guided | 1, 2, start of 3 | Steps; compare with GPIS after each step |
| Half guided | rest of 3, 4, 5, 6 | Task, hints, checker |
| Independent | 7, 8, 9, Python track (second half) | Requirements only; compare with GPIS at the end |

## Overview

| # | Module | Rebuilds in GPIS | Level | Weeks |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Command line, Git and how the web works | Repository, workflow, request journey | Guided | 6 |
| 2 | JavaScript and TypeScript | The pure rules in `src/lib` | Guided | 8 |
| 3 | Frontend with Next.js | App shell, login, Students, score entry | Guided → half | 8 |
| 4 | Databases | Schema, temporal model, constraints, RLS | Half guided | 7 |
| 5 | Backend and auth in Next.js | Server Actions, roles, import, assessment workflow | Half guided | 7 |
| 6 | System design | (case study) GPIS for 50 schools | Half guided | 4 |
| 7 | Security, testing and DevOps | Test suite, CI, deploy, backups, incidents | Half → independent | 8 |
| 8 | Algorithms and problem solving | Ranking, aggregates, search, allocation | Independent | 4 |
| 9 | Capstone | Report cards and one more full workstream | Independent | 8 |
| P | Python track | A FastAPI service beside GPIS | Half → independent | 8 |

System design comes after Databases, as decided. Backend sits between them because the case
study needs to know what a request does on the server.

---

## Module 1 — Command line, Git and how the web works (6 weeks, guided)

**Goal.** Work in a terminal without fear, keep work safe in Git, and explain what happens
between typing a URL and seeing a page.

**Rebuilds.** No GPIS feature yet. You set up `gpis-rebuild` the way GPIS is set up: folder
layout, `README.md`, an `AGENTS.md`-style rules file, small commits, one topic each.

| Project | Outcome | Checker |
| :--- | :--- | :--- |
| 1.1 Find your way | Repair a seeded folder: paths, links, permissions; edit a config file in the terminal | `files`: final folder state matches; `doc`: owner/group/other explained |
| 1.2 Log report | Turn a sample access log into a ranked failure report with pipes | `tests`: output for normal, empty and odd-filename inputs; exit codes |
| 1.3 Processes and ports | Find a process that leaks children and a server bound to the wrong address | `doc`: evidence file with process tree and socket output; `tests`: fixed server answers on the right address |
| 1.4 Git rescue | Resolve a merge conflict and recover a "lost" commit | `git`: expected history, no force-push needed, no secret in any commit |
| 1.5 Request journey | Trace the GPIS login request: DNS, TLS, proxy, app, database, browser | `doc`: diagram plus captured evidence; headings for each hop and its cache |
| 1.6 Project home | Create `gpis-rebuild` with README, rules file, lint and a first CI-ready script | `files` + `static` + `git` (small commits, clear messages) |

## Module 2 — JavaScript and TypeScript (8 weeks, guided)

**Goal.** Write correct, typed, tested functions. Read unfamiliar code and fix it without
rewriting it.

**Rebuilds.** The pure business rules of GPIS (no screen, no database): the code under
`src/lib` that turns scores into remarks, positions and totals.

| Project | Outcome | Checker |
| :--- | :--- | :--- |
| 2.1 Grading scale | Score → remark (80–100 Highest … 0–39 Lowest), never stored | `tests`: every boundary; invalid input refused |
| 2.2 Class ranking | Standard competition ranking on total score (90, 90, 80 → 1, 1, 3) | `tests`: ties, one student, missing subjects still ranked |
| 2.3 Score rules | Validate marks against stored maxima; blank is not zero | `tests`: 0 accepted, blank stays blank, over-maximum refused; `static` |
| 2.4 School dates and names | School "today", term dates, name search in any word order | `tests`: time zone edge cases; search ignores full stops and order |
| 2.5 Repair, do not rewrite | Fix three seeded bugs in a small unfamiliar module | `tests`: a failing test you add first, then passing; `git`: small diff |
| 2.6 Typed data shapes | Types for student, class, membership, score; no `any` | `static`: strict `tsc`; `tests`: type-level checks |

## Module 3 — Frontend with Next.js (8 weeks, guided → half guided)

**Goal.** Build accessible, mobile-first screens with Server and Client Components, and know
which one to use.

**Rebuilds.** The GPIS shell and its first screens, with local sample data: login page, app
shell with phone bottom bar, Students list, student profile, score entry screen. Design target
is 360px wide with 44px touch targets, as in GPIS.

| Project | Outcome | Checker |
| :--- | :--- | :--- |
| 3.1 Portfolio site | Your own site: about, projects, writing; deployed on Vercel free tier | `page`: 360px, no sideways scroll, keyboard reachable; `static` |
| 3.2 App shell | Sidebar on computers, one bottom bar plus More on phones | `page`: every link reachable at 360px; targets ≥ 44px |
| 3.3 Students list | Search, filters, paging in the URL; table becomes cards on phones | `page`: filters survive paging; empty and error states exist |
| 3.4 Student profile | Tabs for overview, class history, documents | `page`: tab from the URL; nothing hidden on phones |
| 3.5 Score entry screen | One part at a time, autosave to a local draft, one bottom button | `page`: typing, moving between students, unsaved-work warning |
| 3.6 Print layer | One shared A4 portrait layout used by two documents | `page`: print styles applied; header comes from one config module |

Projects 3.1–3.3 are guided. From 3.4 you get the task, hints and the checker.

## Module 4 — Databases (7 weeks, half guided)

**Goal.** Design a schema that cannot hold wrong data, write SQL with confidence, and recover
from loss.

**Rebuilds.** The GPIS data model in local PostgreSQL / local Supabase: students, classes,
academic years and terms, and above all the **temporal model** — a student has no class
column; class membership is a dated record; every score points to the membership it was
earned under.

| Project | Outcome | Checker |
| :--- | :--- | :--- |
| 4.1 First schema | Students, classes, years, terms as migrations that replay from empty | `sql`: schema matches; migrations run twice without error |
| 4.2 Membership over time | Enrolment periods; overlaps prevented by the database, not by code | `sql`: overlapping insert is refused; move at a term boundary works |
| 4.3 Scores that explain themselves | Scores store their maxima and their membership; CHECK constraints | `sql`: over-maximum refused; old term still shows the old class |
| 4.4 Row-Level Security | RLS on every table; deny by default; role from `app_metadata` | `sql`: as each role, allowed and refused queries; no table without RLS |
| 4.5 Reports in SQL | Class list, ranking and "who counts" (open membership **and** active) | `sql`: results equal the expected rows, including a withdrawn student |
| 4.6 Backup, restore, replica | Restore deleted data from a backup; show that a replica copies deletions too | `doc`: measured data-loss window and restore time; `sql`: restored rows present |

## Module 5 — Backend and auth in Next.js (7 weeks, half guided)

**Goal.** Build server-side features that are safe when the client lies: validate on the
server, authorise every action, keep writes atomic.

**Rebuilds.** GPIS's working core: login with school usernames, roles, admitting and importing
students, and the assessment workflow (Enter scores → Submit → Preview → Issue & Print).

| Project | Outcome | Checker |
| :--- | :--- | :--- |
| 5.1 Login and roles | Supabase Auth, role from `app_metadata`, lockout after failed tries | `tests`: role cannot come from the browser; `files`: no secret key in `src/` |
| 5.2 Admit a student | Four-step form; Server Action validates again; database constrains | `tests`: bad input refused at all three layers; `page`: steps at 360px |
| 5.3 Student import | Excel file → preview → confirm; any invalid row is reported | `tests`: sample files; duplicate and bad-date rows; nothing half-written |
| 5.4 Submit scores | A whole subject changes state together: draft → submitted | `sql` + `tests`: only submitted rows reach a report; draft never does |
| 5.5 Send back and resubmit | After issue, only Admin or Root sends a subject back, with a reason | `tests`: wrong role refused; reason required; history cannot be changed |
| 5.6 Issue a document | An issued result is a frozen snapshot; reprint shows the same result | `sql`: later score change does not change the issued snapshot |

## Module 6 — System design (4 weeks, half guided)

**Goal.** Reason about load, cost and failure with numbers, and defend trade-offs in writing.

**Rebuilds.** Nothing is added to your GPIS. The case study is **"GPIS for 50 schools"**. GPIS
stays single-school; you design what would have to change, and why GPIS was right not to do it.

| Project | Outcome | Checker |
| :--- | :--- | :--- |
| 6.1 Capacity estimate | Users, requests, rows and storage for 50 schools in report-card week | `doc`: numbers with stated assumptions; totals add up (checker recomputes) |
| 6.2 Multi-tenancy options | Compare one database per school, one schema per school, shared tables with a school id | `doc`: trade-off table: isolation, cost, migrations, RLS, backup, restore |
| 6.3 Scaling reads and caching | Find the three heaviest GPIS reads; design caching and when to clear it | `doc`: what is cached, for how long, what makes it stale; `sql`: a query plan before and after an index |
| 6.4 Queues and slow work | Design PDF making and bulk SMS as background jobs with retries | `doc`: sequence diagram, retry and duplicate rules, what the user sees |
| 6.5 Rate limits and abuse | Limits for login, search and exports; what happens at the limit | `doc`: limits with reasons; `tests`: a small local rate limiter passes the suite |
| 6.6 Design review | One design document for the whole case, then a written defence | `doc`: required sections present; self-review checklist completed |

## Module 7 — Security, testing and DevOps (8 weeks, half guided → independent)

**Goal.** Prove the system is safe and working, ship it without fear, and recover when it
breaks.

**Rebuilds.** What surrounds GPIS's code: its offline test suite, CI checks, Vercel deployment,
encrypted backups and restore tests, and its habit of writing down incidents.

| Project | Outcome | Checker |
| :--- | :--- | :--- |
| 7.1 Negative tests | For every role and table: what must be refused | `tests`: your suite catches three seeded permission holes |
| 7.2 Security review | Review your own app: RLS, definer functions, actions, storage, secrets | `doc`: findings table with evidence; `sql`: anonymous visitor reaches only the listed functions |
| 7.3 CI pipeline | Lint, types, build and tests on every push; build fails on a secret in `src/` | `files`: workflow present; `git`: a seeded bad commit is rejected locally by the same script |
| 7.4 Deploy and configure | Staging on Vercel free tier and Supabase; settings written as repeatable steps | `doc`: runbook; `page`: deployed login works; second run changes nothing |
| 7.5 Web stack debugging | Repair a broken local setup: wrong route, wrong permission, used-up connections | `tests`: service healthy after restart; `doc`: hypotheses and evidence |
| 7.6 Incident and postmortem | Diagnose a seeded outage, restore service, write a blameless report | `doc`: impact, timeline, causes, follow-ups; `sql`: data restored |

Projects 7.1–7.3 are half guided; 7.4–7.6 give requirements only. The traffic lab (plain
versus encrypted login on a local teaching network) is an optional extra in 7.2.

## Module 8 — Algorithms and problem solving (4 focused weeks, practised from Module 2 on)

**Goal.** Choose the right data structure, state the cost of a solution, and prove it correct
with tests.

**Rebuilds.** The parts of GPIS that are really algorithms: ranking, the JHS 3 BECE aggregate
(all Core subjects plus the best 2 Electives), name search, and paying off the oldest debt
first.

| Project | Outcome | Checker |
| :--- | :--- | :--- |
| 8.1 Ranking at scale | Rank 100,000 scores with ties in one pass after sorting | `tests`: correctness and a time limit; `doc`: cost explained |
| 8.2 BECE aggregate | Best-2-of-N electives plus all cores; blanks handled | `tests`: ties, missing subjects, fewer than two electives |
| 8.3 Oldest debt first | Allocate a payment across charges from different terms | `tests`: exact money (no rounding drift); partial and over-payment cases |
| 8.4 Search | Match names typed in any order; compare two approaches by measurement | `tests`: results; `doc`: fair benchmark and its limits |
| 8.5 Number puzzle (optional) | Factor small integers within fixed limits | `tests`: correctness under a time limit; no claim about real encryption |

## Module 9 — Capstone (8 weeks, independent)

**Goal.** Deliver a complete GPIS workstream alone, from proposal to release, and defend it.

**Rebuilds.** Report cards end to end (Creche–JHS 2 report card; JHS 3 results slip with BECE
aggregate and no class position), plus **one** more workstream you choose: Class Teacher
workspace, Fees and payments, or Books sales.

You get requirements only. The five project stages are self-study checklists:

| Stage | Outcome | Checker |
| :--- | :--- | :--- |
| 9.1 Proposal | Problem, users, scope and exclusions, two trade-offs, risks | `doc`: required headings |
| 9.2 MVP specification | Data flow, data model, 3–5 user stories, acceptance tests, security notes | `doc`; `files`: acceptance tests exist (failing is fine) |
| 9.3 Implementation plan | Small tasks, order, estimates, risky parts tried first | `doc`; `git`: plan committed before the build starts |
| 9.4 Build and review | The workstream, built in small commits, with tests | `tests` (course suite for report cards) + `static` + `sql` + `page` |
| 9.5 Release and defence | Deployed demo, release notes, README, architecture defence, comparison with GPIS | `page`: deployed demo; `doc`: defence and comparison present |

The capstone passes when the checker passes **and** you can explain every trade-off without
notes. The second part is self-assessed.

---

## Python track (8 weeks, after the capstone; half guided → independent)

**Goal.** Learn Python well enough to build and run a small, typed, tested web service, and to
know when a second service is worth its cost.

**Rebuilds.** Nothing is replaced. You **add** a Python (FastAPI) service beside your GPIS: a
read-only reporting service for class results, called by the Next.js app.

| Project | Outcome | Checker |
| :--- | :--- | :--- |
| P.1 Python core | Port the grading, ranking and aggregate rules from Module 2 to typed Python | `tests`: same cases as Module 2; type check passes |
| P.2 Log report again | Redo project 1.2 as a structured Python program | `tests`: same inputs, same report; odd input handled |
| P.3 API consumer | Export from a local paginated API: timeouts, 429, repeated cursor, safe CSV | `tests`: a local fake API that misbehaves on purpose |
| P.4 FastAPI service | `/results/class/{id}` reads your database with a read-only role | `tests`: contract tests; wrong token refused; `sql`: role cannot write |
| P.5 Join the two | Next.js calls the service; clear behaviour when the service is down | `page`: results shown; error state when the service is stopped |
| P.6 Was it worth it? | One page: what the second service cost and gave | `doc`: required headings; self-review |

P.1–P.3 are half guided; P.4–P.6 give requirements only.

---

## Rules that apply to every module

- **Quality gates** (blueprint §10, the ones that apply): rules and permissions written down;
  input validated at client, server and database; migrations replay from empty; negative
  tests for every role; no secrets in code or logs; keyboard, contrast and 360px checked;
  error, loading and empty states designed; documents updated.
- **Before merging a feature**, write four short notes: model, threat model, test plan,
  reflection (blueprint §11).
- **AI use:** to explain, to criticise your design, to suggest tests. Not to write the
  answer. You must be able to rebuild the core without it.
- **Sources:** lessons are original. ALX pages are never copied, uploaded or published
  (blueprint §12.9).
- **Results** are shown as four separate facts: complete, correct (checker), reviewed (self),
  on time. A project not yet reviewed is "pending", not zero.
