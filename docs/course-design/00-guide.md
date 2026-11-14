# Course design — the guide every unit follows

This folder is the design of the whole course. It is written for the builder: build one module
at a time from its file, and make no course decisions of your own. If something is missing,
it belongs in `99-open-questions.md`, not in a guess.

| File | Holds |
| :--- | :--- |
| `00-guide.md` | The rules below: one course, one shape |
| `01-command-line.md` … `09-capstone.md`, `10-python.md` | Every unit of a module, ready to build |
| `99-open-questions.md` | What the documents could not decide. Answer these before the units they block |

Read with: `docs/decisions.md` (ADR-1 to ADR-8), `docs/curriculum.md`, `content/README.md`,
and the built unit `content/module-01/unit-01/`, which is the quality bar.

Where a rule here says **[Qn]**, an open question touches it. The rule is written so that the
unit can still be designed; the question says what changes with each answer.

---

## 1. Names and places

| Thing | Rule | Example |
| :--- | :--- | :--- |
| Unit folder | `content/module-NN/unit-KK/` | `content/module-02/unit-03/` |
| Unit id | `m<N>-u<K>`; Python track `py-u<K>` | `m2-u3`, `py-u4` |
| Project (check) id | `m<N>-p<K>`; Python track `py-p<K>`. Same K as the unit | `m2-p3` |
| Quiz id | unit id + `-quiz` | `m2-u3-quiz` |
| `module` in front matter | 1–9; Python track is `10` (slug `py` in `course.yaml`) | `10` |
| Lab folder | `~/academy-labs/<check id>/…`, built by `npx academy init <check id>` | `~/academy-labs/m1-p2/logs` |
| The learner's GPIS | `~/projects/gpis-rebuild` (made in unit 1.1's own build; a Git repository from unit 1.4's own build, checked in unit 1.6) | |
| The read-only GPIS | `~/reference/gpis-school-system` (cloned in unit 1.1, write permission removed) | |
| The portfolio site | `~/projects/portfolio` (unit 3.1) | |
| Design documents | `~/projects/gpis-rebuild/docs/design/` (module 6) | |

One unit = one project of `curriculum.md` = one `check/` folder. There are 58 units.

**Two kinds of project.**

| Kind | `lab:` in `check.yaml` | The checker runs in | Used for |
| :--- | :--- | :--- | :--- |
| Lab project | `root` + `seed` | the lab folder | A seeded situation to repair or analyse (most of module 1, 2.5, 7.5, P.2, P.3) |
| Repo project | none | the folder where the learner runs the command: the root of `gpis-rebuild` (or `portfolio`) | Everything the learner builds and keeps |

A repo project's `lab.md` always starts with "Run every command from `~/projects/gpis-rebuild`".

---

## 2. Unit anatomy and time

Every unit has the nine files of `content/README.md`, in the order of the eight steps.

| Step | File | Share of the unit's time | What it is |
| :--- | :--- | :--- | :--- |
| 1 Lesson | `lesson.md` | 12% | Ideas, in numbered sections, each with one small example |
| 2 Guided example | `example.md` | 12% | A worked task the learner types, with expected output |
| 3 Quiz | `quiz.json` | 3% | Retrieval, marked on the server |
| 4 Lab | `lab.md` + `check/` | 30% | The project of `curriculum.md` |
| 5 Debugging lab | `debugging-lab.md` | 13% | A planted fault; cause first, then the smallest fix |
| 6 Own build | `own-build.md` | 17% | A small variation with no steps, in the learner's own repository when it fits |
| 7–8 Review and mastery | `review.md` | 13% | Self-review, comparison with GPIS, questions without notes |

`unit.md` holds the front matter, one sentence "After this unit you can…", the step table with
minutes (the shares above applied to `minutes`, rounded to 15), and "Before you start".

**Minutes.** Each module file gives `minutes` per unit. They add up to about the module's
weeks × 13 hours. Unit 1.1 is already built at 360 minutes and stays so. **[Q6]**

**Lesson length.** A lesson is at most about 150 lines. Where a module file marks a lesson
"two parts", `lesson.md` has `## Part A` and `## Part B`, each at most about 130 lines, with a
line "Stop here; do steps 1–3 of the guided example; then read Part B". **[Q5]**

---

## 3. Language and tone

- Plain English for a reader who is not a native speaker. Short sentences. One idea per
  sentence. No idioms, no jokes that need culture to understand.
- A new term is explained the first time it appears, in one sentence, and listed under
  "Words to remember" at the end of the lesson.
- Say **why** before **how**. Each lesson section answers "what problem does this solve?".
- Commands are for WSL 2 (Ubuntu). One command per code block, tagged `bash`. Expected output
  is shown as text after the block, never inside it.
- British spelling, as in the rest of the repository. Dates as `14 November 2026`.
- Names in examples are Ghanaian school examples already used in unit 1.1 (Godfred Asante,
  Ama Birikran, Esi Kyei, Basic 3, JHS 3). No real person's data.
- Money is GHS with two decimals. Classes use GPIS names (Creche, Kindergarten 1–2,
  Basic 1–6, JHS 1–3).
- Never write "simply", "just", "obviously".

---

## 4. Pointing to GPIS

GPIS (`srufai1/gpis-school-system`) is the reference answer (ADR-1).

- `gpis_part` in the front matter names the part of GPIS the unit relates to, in words a
  learner understands ("The grading scale every screen and document uses").
- Every GPIS rule a lesson, quiz or test uses is quoted with its decision number, for example
  "(GPIS D-02)". The rules this course uses are listed in each module file under "GPIS rules
  used", copied from `docs/DECISIONS.md` and `docs/CURRENT_RULES.md` of GPIS. **Never invent a
  rule and never round a rule off.** If a rule is not in the module file, stop and ask.
- A lesson may name a GPIS file path ("see `src/lib/assessments/raw-marks.ts`"). It never
  copies GPIS code into the lesson. The learner opens the read-only copy.
- **When the learner may open GPIS code** depends on the guidance level (section 5).
- Every `review.md` has "Compare with GPIS": two or three questions about what GPIS does
  differently and why. Each module file gives the questions.
- Where GPIS changed a rule over time (for example approval was removed by D-218), teach the
  **current** rule and name the decision that made it current.

---

## 5. How guidance fades (ADR-4)

| Part | Guided | Half guided | Independent |
| :--- | :--- | :--- | :--- |
| `lesson.md` | Full | Full | Short: the ideas and where to read more |
| `example.md` | Every command, with expected output | The first half in full; the second half as "now do the same for…" | A worked example of a **different** problem of the same kind |
| `lab.md` → Requirements | Numbered table | Numbered table | Numbered table (this is all there is) |
| `lab.md` → Steps | Yes: one step per requirement, naming the command or file | No | No |
| `hints` in `lab.md` | 2–3, under "If you are stuck" | 2–4, each folded (`<details>`), each naming a place to look, not the answer | None |
| GPIS code | After each step | After the checker passes, or after a written attempt of 30 minutes | Only after the checker passes |
| `debugging-lab.md` | Says how many faults there are | Says how many faults | Says only the symptom |
| `own-build.md` | Requirements only (always) | Requirements only | Requirements only |

A hint never contains the finished code or command with its arguments. It names the idea
("ties share a position: what should the next position be?") or the tool (`man chmod`).

`course.yaml` shows a module's main level; the level of each unit is in its front matter and
in the module file.

---

## 6. Lesson rules

- Numbered sections (`## 1. …`). Each section: the problem, the idea, one small example, and
  where the idea shows in GPIS.
- At most one diagram per lesson, as a Mermaid block or a text tree. The module file says
  which.
- A "Common mistakes" section near the end, 3–5 items, each "what people do → what happens →
  what to do instead". The module file lists them.
- End with "Words to remember".
- No exercise in the lesson. Practice starts in the guided example.

## 7. Guided example rules

- One realistic task, done from start to finish. The module file gives the steps.
- Each step: one sentence of purpose, the command or the code to type, the expected output.
- "Type every command yourself. Do not paste." (as in unit 1.1).
- It uses the read-only GPIS copy or a throw-away folder under `~/academy-labs/scratch/`. It
  never edits `gpis-rebuild`, so a mistake costs nothing.
- It ends with "What you just used": the list of commands or ideas.

---

## 8. Quiz rules

| Rule | Value |
| :--- | :--- |
| Questions | 6–8 per unit. Each module file gives the plan for every question |
| `pass_mark` | Questions minus 2 (7 → 5, 6 → 4, 8 → 6) |
| Options | 4 per question (3 only when a fourth would be silly) |
| Kinds | At least two "predict the result" (given this input or command, what happens?), at least one "find the mistake", at most two "definition" |
| GPIS | At least one question uses a GPIS rule with real numbers, when the unit has one |
| `why` | One or two sentences: the reason the right answer is right |
| `wrong` | A reason for **every** wrong option, saying what the learner probably thought |
| Position of the right answer | Spread over the options; not always the first |

A good wrong option is a real mistake a learner makes: dense ranking instead of competition
ranking, 0 instead of blank, `chmod 644` when the group must not read. "None of the above" and
joke options are not allowed. No trick wording. Code in a prompt is at most 6 lines.

Quiz answers never appear in `lesson.md` as a list. The quiz file is not shipped in the
checker package (T17).

---

## 9. Lab and seed rules

**`lab.md` always has, in this order:** level, checker id and time; one paragraph of situation;
"Start" (the `init` command for a lab project, or the folder to work in); "What done means"
(the numbered requirements table); "Steps" (guided only); "If you are stuck" (hints, as the
level allows); "Check your work" (the checker command); "Compare with GPIS".

**Requirements** are observable facts ("`rank([90, 90, 80])` returns `[1, 1, 3]`"), never
activities ("learn about ranking"). Every requirement is checked by at least one step, or is
marked "(self-review)".

**Seeds (`check/fixtures/seed.sh`)**

- `#!/usr/bin/env bash`, `set -euo pipefail`, one argument: the lab root. It is run by
  `academy init`, with a 30-second limit.
- Idempotent: it removes and rebuilds the lab root, so `--reset` always gives the same start.
- Everything it writes is under `~/academy-labs`. It never touches `~/projects`.
- No network. No `sudo`. No package installs. If a lab needs a tool, the unit's "Before you
  start" names it and `lab.md` shows the install command.
- Deterministic: no random data, no current date in file contents. Where a lab needs "today",
  the seed writes a fixed date into a file the task reads.
- Seeded data is synthetic and small (tens of lines, not thousands), unless the module file
  gives a size.
- A seed may start nothing that keeps running. Where a lab needs a running process (1.3,
  7.5), the seed writes a `start.sh` that the learner runs.

**Docker.** Only 4.6 and 7.5 need Docker, plus two optional extras (7.2 traffic lab, P.4
container). They are marked **[Docker]** in the unit title, in "Before you start", and in
`requires`. Each gives the no-Docker path of `curriculum.md`. **[Q8]**

**Network.** A lab uses the network only when the module file says so: the learner's own
Supabase lab project (modules 4, 5, 7, 9, Python), Vercel (3.1, 7.4, 9.5), `git clone` of the
read-only GPIS (1.1), `npm install`.

**Secrets.** `.env` and `.env.local` are never committed. Every repo project from unit 1.6 on
has a `git` step with `no_secrets`. The lab database address lives in `.env` as
`LAB_DATABASE_URL` (the only place the checker reads it).

---

## 10. Check design rules

A check is `check/check.yaml` plus `check/tests/` and `check/fixtures/`. It ships to the
learner (Known limits in `decisions.md`), so treat it as public.

### 10.1 Which step kind for which evidence

| Evidence | Kind | Notes |
| :--- | :--- | :--- |
| A path exists, is a file / directory / link, has a mode, or is absent | `files` | `sha256_of` compares with a fixture; use it only when the exact content is the requirement (a config after one edit) |
| A written answer exists and is long enough | `doc` | Headings must match exactly; `min_words_per_heading` 15–40. It cannot judge the text |
| The learner's function returns the right values | `tests` with `files:` | Node test files in `check/tests/*.test.mjs`, run by `node --test` in the project. They import the learner's module from `process.env.ACADEMY_PROJECT` |
| A command prints the right thing or ends with the right code | `tests` with `run:` | One command, `bash -c`, in the lab or project folder. Use `expect_stdout` only for short exact output; otherwise `expect_stdout_contains` |
| The project lints, type-checks and builds | `static` | Runs the project's own `lint`, `tsc`, `build` |
| History: number of commits, message quality, no secret | `git` | Anything else about history (a branch exists, a merge happened) is a `tests` step that runs a `git` command |
| The database refuses or returns exactly this | `sql` | Lab database only. See 10.4 |
| A page shows this at 360px | `page` | `http://localhost` only. It loads one address and looks; it does not click or type. See 10.5 |

### 10.2 Required and optional

- `required: true` for every requirement of the project. The project passes when all required
  steps pass.
- `required: false` only for: an extra the module file marks optional; a step that needs
  Docker or a deployed site, where the unit has another path. An optional step that cannot run
  reports `needs`, never `fail`.
- A check has 4–14 steps. Prefer several small steps to one big one: the learner sees which
  requirement failed.
- Order steps from cheap to costly: `files`, `doc`, `git`, `tests`, `static`, `sql`, `page`.

### 10.3 Titles, messages, reasons

- A step `title` says the requirement as a fact, in the learner's words, at most 80
  characters: "Ties share a position and the next one is skipped".
- Every required step has an entry under `messages:`. It is shown first when the step fails.
  It says **what is wrong, not how to fix it**: "rank() gave a tied student the wrong
  position." Not: "Use the index of the first equal score."
- A test name is a sentence the learner can act on, because failed test names are shown:
  `test("90, 90, 80 gives positions 1, 1, 3", …)`. Never `test("case 4")`.
- One line, at most 300 characters, no code.

### 10.4 SQL steps

- The project's `.env` must hold `LAB_DATABASE_URL`, and the database must hold
  `public.academy_lab` with `purpose = 'ruftech-academy lab'` (made in unit 4.1). Without
  them the step reports `needs`.
- Everything runs in one transaction in a scratch schema and is rolled back. So a step may
  insert test rows into the learner's tables freely; nothing stays.
- One statement per query. Put multi-statement preparation in `setup:`.
- To act as a role: a query `set local role authenticated`, then
  `select set_config('request.jwt.claims', '<json>', true)`, then the query under test, then
  `reset role`.
- Make results exact: cast counts to `int` (`count(*)::int`), dates to `text`, and always
  `order by`. `expect_rows` compares the JSON of the rows.
- Use `expect_error: true` for "the database must refuse this". Put the reason in the message.
- Table and column names the checks rely on are fixed in the module files ("Schema contract").
  The learner is told them in `lab.md`; without that a check could not be written.

### 10.5 Page steps and behaviour in the browser

- The learner starts the app (`npm run dev`); the step opens one address at 360 × 780.
- It can check: the status, the title, that given texts are visible, no sideways scroll, and
  a minimum tap-target height (`min_target_px: 44`).
- State that must be checked goes in the address, as GPIS does (search, filters, page, tab).
  `http://localhost:3000/students?q=asante&page=2` is checkable; a click is not.
- Behaviour that needs clicking or typing (score entry, a multi-step form) is checked by a
  `tests` step with `files:` whose test file drives the page with Playwright, loaded from the
  project (`createRequire(process.env.ACADEMY_PROJECT + "/package.json")("playwright")`).
  The test's first assertion is "the app answers at http://localhost:3000", so the reason is
  clear when it is not running. **[Q4]**
- A deployed site cannot be opened by a `page` step. **[Q3]**

### 10.6 What must not be in a check folder

- No solution file. A fixture holds inputs and expected **outputs**, never the code that
  produces them.
- Tests assert behaviour through the public function or command only. They do not read the
  learner's source to look for keywords, except where the module file says so (for example
  "no `any`", "no secret key in `src/`").
- No lesson text, no quiz answers, no GPIS code.
- Expected values that are GPIS rules (the grading table) are in the tests, because the tests
  must contain them. That is accepted (Known limits).
- Tests include cases the lesson did not show, so copying the examples does not pass.

### 10.7 Versions

`version: 1.0.0` for every new check. Any change in `check/` needs a new version
(`npm test` fails otherwise). `requires:` lists what the unit needs, from this list only:
`wsl`, `node`, `git`, `github`, `lab-db`, `supabase`, `vercel`, `playwright`, `docker`, `python`.
The checker shows it; it does not act on it.

---

## 11. Debugging lab rules

- A fault is planted in a small, working thing. The learner sees a **symptom** in the words a
  user would use ("the report shows 0 for a subject nobody marked").
- The learner writes `diagnosis.md` with exactly these five headings, as in unit 1.1:
  `## Observe`, `## Possible causes`, `## Tests`, `## Cause`, `## Fix`.
- At least three possible causes, one test per cause, then the smallest fix. Rewriting the
  file is not a fix.
- Where there are two faults, the second shows only after the first is fixed.
- Each module file gives, per unit: the planted fault(s), the symptom, the evidence expected
  under each heading, and the fixed state.
- GPIS's own rule is quoted in every debugging lab: OBSERVE → ISOLATE → TEST → PROVE →
  DOCUMENT → MOVE ON.
- **How a debugging lab is seeded and checked is open. [Q1]** Each unit therefore lists the
  seed contents and the fixed-state facts in a form any answer to Q1 can use.

## 12. Own build rules

- No steps and no hints at any level. 4–7 requirements.
- A variation of the lab, not a repeat: another input, another rule of the same family, or the
  same idea applied in `gpis-rebuild`.
- From unit 1.6 on it ends with a commit in `gpis-rebuild`.
- It ends with "Then compare with GPIS" and a note file in `gpis-rebuild/notes/`.
- **How an own build is checked is open. [Q1]** Each unit lists its requirements as facts.

## 13. Review and mastery rules

`review.md` has four parts, as in unit 1.1:

1. **Review checklist** — 5–7 tick boxes. Always includes: the checks pass; I typed it
   myself; I can explain every line; in the debugging lab I wrote the cause before the fix.
2. **Compare with GPIS** — the questions from the module file; answered on the platform.
3. **Mastery check** — 4–6 tasks done with the lesson closed, each ending in something the
   learner can run to test themselves. "You have mastered this unit when…".
4. **Reflection** — the same two questions in every unit: "What surprised me?" and "What will
   I do differently in the next unit?".

It always says: "This is self-assessed. Nobody else checks it."

---

## 14. Building a module: order and "done"

Build one unit at a time, in position order. For each unit:

1. `unit.md` (front matter from the module file).
2. `check/`: fixtures and seed first, then `check.yaml`, then tests.
3. **Prove the check**: on a fresh seed (or an empty project) every required step fails; on a
   solved copy every required step passes. Keep the solved copy outside the repository.
4. `lab.md`, then `debugging-lab.md` and `own-build.md`.
5. `lesson.md`, `example.md` (run every command of the example yourself).
6. `quiz.json`, `review.md`.
7. `npm run content`, then `npm test`.

**A unit is done when**

- [ ] all nine files exist and `npm test` is green;
- [ ] `index.json` and `manifest.json` are rebuilt and committed;
- [ ] the check fails on the start state and passes on a solved state, and both runs are
      pasted in the commit message or the report;
- [ ] every requirement in `lab.md` is covered by a step or marked "(self-review)";
- [ ] every message says what is wrong and none says how to fix it;
- [ ] every command in `example.md` was run and its output matches;
- [ ] every GPIS rule carries its decision number and matches the module file;
- [ ] the quiz has a reason for every wrong option and the right answers are spread;
- [ ] no file under `check/` holds a solution;
- [ ] the level's rules of section 5 are kept (no Steps in a half-guided lab);
- [ ] reading level: no sentence over 25 words in `lesson.md` (spot check ten).

**A module is done when** every unit is done, the units were tried in order on a clean WSL
account from the first command to the last, and `course.yaml` needs no change.

One commit per unit: `Content: unit 2.3 score rules`.

---

## 15. Shape of a unit in the module files

Each unit in a module file has these blocks, always in this order:

1. **Front matter** — the exact values.
2. **Outcomes** — "After this unit you can…".
3. **Lesson** — sections and key ideas; diagram; common mistakes.
4. **Guided example** — the worked task, in steps.
5. **Quiz plan** — per question: idea, right answer, why each wrong option is wrong.
6. **Lab** — start state and fixtures; requirements; Steps and Hints as the level allows;
   finished state.
7. **Debugging lab** — faults, symptom, evidence, fixed state.
8. **Own build** — requirements.
9. **Review** — checklist extras, GPIS comparison, mastery tasks.
10. **Check plan** — every step: id, kind, required, what it verifies; messages.
11. **Needs** — earlier units, tools, accounts.
