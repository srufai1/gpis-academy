# Module 1 — Command line, Git and how the web works

Read `00-guide.md` first. Level: **guided** (all six units). 6 weeks, about 78 hours.

| Unit | Title | Project | Kind | Minutes | Check steps |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1.1 | The terminal and the filesystem | `m1-p1` Find your way | Lab | 360 | 10 (built) |
| 1.2 | Text, pipes and small scripts | `m1-p2` Log report | Lab | 840 | 9 |
| 1.3 | Processes, signals and ports | `m1-p3` Processes and ports | Lab | 780 | 8 |
| 1.4 | Git: a history you can trust | `m1-p4` Git rescue | Lab | 900 | 11 |
| 1.5 | How the web works: one request's journey | `m1-p5` Request journey | Repo | 840 | 9 |
| 1.6 | A project home | `m1-p6` Project home | Repo | 960 | 13 |

**GPIS rules used in this module** (quote with the number; do not add others):

| Rule | Text to use |
| :--- | :--- |
| GPIS AGENTS.md, "Engineering discipline" | OBSERVE → ISOLATE → TEST → PROVE → DOCUMENT → MOVE ON. "Never change working code merely to make an error message disappear." |
| GPIS AGENTS.md, security rule 7 | `.env.local` and real keys are never read back or written into a file; `.env.example` holds variable **names** only |
| GPIS AGENTS.md, "Working style" | Small, reviewable changes; several focused commits, not one sweeping one |
| GPIS AGENTS.md, "Interface rules" | School details come from one config module (`src/config/school.ts`); no hard-coded school name |
| GPIS AGENTS.md, security rule 4 | Every schema change is a migration file in `supabase/migrations/` (used only as a folder-layout example) |

**Setup before unit 1.1** (already in `curriculum.md`): WSL 2 with Ubuntu, Git, Node.js 22.18 or
newer, VS Code with the WSL extension, `npx academy doctor` passes.

---

## Unit 1.1 — The terminal and the filesystem

**Built. Keep as is.** Front matter: `id m1-u1`, `module 1`, `position 1`, `guidance guided`,
`minutes 360`, `project m1-p1`, `requires [wsl]`.

One defect is listed in `99-open-questions.md` **[Q1]**: `debugging-lab.md` and `own-build.md`
name checks (`m1-p1-debug`, `m1-u1-own`) that do not exist and that the format cannot hold.
Do not change the unit until Q1 is answered.

What later units rely on from 1.1: the read-only copy `~/reference/gpis-school-system`;
the folder `~/projects/gpis-rebuild` with `docs/`, `scripts/`, `notes/`; `docs/commands.md`;
the five-heading `diagnosis.md`.

---

## Unit 1.2 — Text, pipes and small scripts

### Front matter

| Field | Value |
| :--- | :--- |
| id / project | `m1-u2` / `m1-p2` |
| title | Text, pipes and small scripts |
| module / position | 1 / 2 |
| guidance | guided |
| minutes | 840 |
| gpis_part | The scripts folder of GPIS, and how a server log is read after a failed sign-in |
| requires | `[wsl]` |

### Outcomes

After this unit you can:

1. join small commands with pipes to answer a question about a text file;
2. count and rank lines with `grep`, `cut`, `awk`, `sort`, `uniq -c` and `head`;
3. write a Bash script that takes an argument, quotes it correctly and refuses bad input;
4. use exit codes and standard error so another program can trust your script;
5. test a script with a normal, an empty and an awkward input before calling it done.

### Lesson (two parts)

| § | Section | Key ideas |
| :--- | :--- | :--- |
| A1 | One job per command | Small tools, joined. Standard input, standard output, standard error. `\|`, `>`, `>>`, `2>`, `<` |
| A2 | Looking inside a file | `cat`, `less`, `head`, `tail -n`, `wc -l`. A log is one event per line |
| A3 | Choosing lines | `grep`, `grep -v`, `grep -c`, `grep -E`. Anchors `^` `$`. Quote the pattern |
| A4 | Choosing columns | `cut -d' ' -f`, `awk '{print $9, $7}'`. Why `awk` is easier when spaces repeat |
| A5 | Counting and ranking | `sort`, `uniq -c` needs sorted input, `sort -k1,1nr -k3,3`, `head -n 5` |
| B1 | A script is a saved pipeline | Shebang, `chmod u+x`, `./name.sh`, `set -euo pipefail` and what each part does |
| B2 | Arguments and quoting | `$1`, `$#`, `"$1"` always in double quotes; what breaks with `term 1 access.log` |
| B3 | Exit codes | `$?`, `exit 0/1/2`, `&&` and `\|\|`, messages for people go to standard error (`>&2`) |
| B4 | Tests for a script | Three inputs every time: normal, empty, awkward name. Compare with `diff` |
| B5 | In GPIS | `scripts/` holds small checks that CI runs; they must exit non-zero on failure or CI stays green by mistake |

- **Diagram:** one text diagram of a pipeline: `access.log → grep → awk → sort → uniq -c → sort -nr → head`, with a three-line sample under each arrow.
- **Common mistakes**
  1. `uniq -c` without `sort` first → the same line is counted in several groups → always sort before `uniq`.
  2. `$1` without quotes → a name with a space becomes two arguments → write `"$1"`.
  3. Printing an error to standard output → the next command in the pipe reads it as data → `>&2`.
  4. `sort -n` on the wrong column → order looks random → name the key: `-k1,1nr`.
  5. Ending a script with `echo done` → exit code is always 0 → `exit` with the real code.

### Guided example — "Who asked for pages that do not exist?"

Folder: `~/academy-labs/scratch/u1-2/`. The example makes its own 12-line `sample.log` with a
here-document (the lines are given in `example.md`), so it does not use the lab's log.

1. Make the folder and the sample log; `wc -l` shows 12.
2. `grep ' 404 ' sample.log` → 4 lines. Explain the spaces round 404.
3. Add `| awk '{print $1}'` → four addresses.
4. Add `| sort | uniq -c` → counts; then show the wrong result without `sort`.
5. Add `| sort -k1,1nr -k2,2` → ranked; ties in address order.
6. Save as `who-404.sh` with shebang and `set -euo pipefail`; run it; `chmod u+x`.
7. Replace the file name with `"$1"`; add the two refusals (no argument → usage on standard
   error, exit 1; file not readable → message, exit 2); show `echo $?` after each.
8. Run with a copy named `my log.txt` to prove the quotes work.

What you just used: `grep awk sort uniq head wc chmod`, `"$1"`, `$#`, `$?`, `>&2`, `exit`.

### Quiz plan (`m1-u2-quiz`, 7 questions, pass mark 5)

| # | Idea | Right answer | Wrong options and why |
| :--- | :--- | :--- | :--- |
| 1 | Predict: `printf 'b\na\nb\n' \| uniq -c` | Three lines, each count 1 | "2 b, 1 a" (thinks `uniq` sorts); "1 a, 2 b" (same, and thinks output is sorted); "error" (`uniq` accepts unsorted input, it only gives a useless answer) |
| 2 | Predict: script run as `./r.sh term 1.log`; value of `$#` | 2 | 1 (thinks the shell knows it is one name); 3 (counts the script name); 0 (confuses with `$?`) |
| 3 | Find the mistake: `if [ ! -r $1 ]; then echo "cannot read"; exit 0; fi` — what is most wrong for a CI script? | It exits 0, so the caller thinks it worked | "`-r` is not a real test" (it is); "`echo` cannot be used in `if`" (it can); "`fi` should be `end`" (Bash uses `fi`) |
| 4 | Where should "usage: report.sh FILE" go? | Standard error | Standard output (it would be read as data by the next command); a file named `error.log` (hides it from the person); nowhere (the user gets no help) |
| 5 | Predict: `sort -k1,1nr` on lines `9 x`, `10 y`, `2 z` | `10 y`, `9 x`, `2 z` | `9 x, 2 z, 10 y` (text order, forgot `n`); `2 z, 9 x, 10 y` (forgot `r`); `10 y, 2 z, 9 x` (text order reversed) |
| 6 | What does `set -e` change? | The script stops at the first command that fails | "prints every command" (that is `-x`); "makes unset variables an error" (that is `-u`); "makes the script run faster" (no) |
| 7 | GPIS: why must a check script in `scripts/` exit non-zero when it finds a problem? | CI reads only the exit code; 0 means "all good" | "So the text is red" (colour is not the signal); "Because Git refuses scripts that exit 0" (no such rule); "It does not matter if the message is clear" (nobody reads a green run) |

### Lab — project 1.2 Log report (lab project)

- **Start:** `npx academy init m1-p2` → `~/academy-labs/m1-p2/logs`.
- **Situation:** the school's web server kept a log for one morning. The head of ICT wants to
  know which requests failed most.

**Seed (`fixtures/seed.sh`) writes:**

| Path | Contents |
| :--- | :--- |
| `access.log` | 60 lines, one request each, in this exact shape: `41.215.160.12 - - [14/Dec/2026:08:03:11 +0000] "GET /login HTTP/1.1" 401 512`. Fixed dates on 14 Dec 2026, 08:00–09:00, in time order. Six client addresses. Failures (status ≥ 400), mixed among the others: `401 /login` × 9, `500 /students/import` × 6, `403 /api/scores` × 4, `404 /favicon.ico` × 4, `500 /reports/print` × 2, `404 /old-page` × 1 (26 lines). The other 34 lines have status 200, 302 or 304 on `/`, `/login`, `/students`, `/dashboard`. Methods: `GET`, and `POST` for `/login` and `/students/import` |
| `empty.log` | 0 bytes |
| `term 1 access.log` | 12 lines, same shape; failures: `404 /favicon.ico` × 3, `401 /login` × 1 |
| `no-failures.log` | 5 lines, all status 200 |
| `README.txt` | Six lines: what the columns of a log line mean |
| `answers.md` | The three headings below, empty |

**What done means**

| # | Requirement | Step |
| :--- | :--- | :--- |
| 1 | `report.sh` exists in the lab folder and you can run it as `./report.sh` | `script-exists` |
| 2 | `./report.sh access.log` prints the five most common failures, one per line, as `COUNT STATUS PATH`, biggest count first; equal counts in path order (A to Z) | `normal-log` |
| 3 | A failure is a line whose status is 400 or more. Lines are grouped by status **and** path | `normal-log` |
| 4 | A log with no failures (or no lines) prints exactly `no failures` and exits 0 | `empty-log`, `clean-log` |
| 5 | A file name with spaces works | `odd-name` |
| 6 | No argument: nothing on standard output, a usage line on standard error, exit code 1 | `no-argument` |
| 7 | A file that does not exist: nothing on standard output, exit code 2 | `missing-file` |
| 8 | `access.log` is unchanged | `log-untouched` |
| 9 | `answers.md` explains your pipeline | `answers` |

Exact output for requirement 2:

```text
9 401 /login
6 500 /students/import
4 403 /api/scores
4 404 /favicon.ico
2 500 /reports/print
```

For `term 1 access.log`: `3 404 /favicon.ico` then `1 401 /login`.

**Steps (guided):** (1) read `README.txt` and the first five lines of the log; (2) on the
command line, print only failure lines; (3) print only status and path; (4) count and rank;
(5) keep five; (6) fix the output order to `COUNT STATUS PATH` with single spaces; (7) save as
`report.sh`; (8) add `"$1"`; (9) add the two refusals; (10) add the `no failures` case;
(11) run all five inputs yourself; (12) fill in `answers.md`.

**Hints:** (a) `awk` can compare a column with a number: look up `$9 >= 400`. (b) `uniq -c`
puts spaces before the count; one more `awk` can print the three columns cleanly. (c) To test
"is the output empty?" look up `[ -z "…" ]` or `grep -c`.

**Finished state:** `report.sh` (mode 700, 750 or 755) beside the untouched logs; `answers.md`
with `## My pipeline, part by part`, `## Why uniq needs sort`, `## How I tested the awkward
cases`, each at least 20 words.

### Debugging lab — "The numbers do not add up"

| Item | Design |
| :--- | :--- |
| Seeded | `by-address.sh` (prints failures per client address) and the same `access.log` and `term 1 access.log` |
| Symptom | "The same address is in the list three times, and the counts are small." Then, after fix 1: "It says `No such file` for `term 1 access.log`, but the file is there." |
| Fault 1 | The pipeline is `awk … \| uniq -c \| sort -nr`: no `sort` before `uniq -c` |
| Fault 2 | The script uses `$1` without quotes in `awk … $1` |
| Evidence | Observe: the command and the repeated address. Causes (3+): log has duplicates; `uniq` needs sorted input; `awk` picks the wrong column. Tests: `awk '{print $1}' access.log \| sort \| uniq -c` by hand; `awk '{print $1}' access.log \| head`. Cause, Fix: one word added (`sort`), then two quote marks |
| Fixed state | `./by-address.sh access.log` prints six lines, one per address, counts adding up to 26; `./by-address.sh "term 1 access.log"` prints counts adding up to 4; the script differs from the seed by at most 2 lines |

### Own build — top pages

In `~/projects/gpis-rebuild`:

1. `scripts/top-pages.sh FILE [N]` prints the N most requested paths among **successful**
   requests (status 200–399), as `COUNT PATH`, biggest first, ties in path order. N defaults to 3.
2. N that is not a whole number above 0 → usage on standard error, exit 1.
3. Missing or unreadable file → exit 2. No successful request → prints `no requests`, exit 0.
4. It works on a file name with spaces.
5. `docs/commands.md` gains five commands from this unit, each with your own one-line meaning.
6. `notes/unit-1-2.md`: the three inputs you tested with, and what each proved.

### Review

- **Checklist extras:** I ran the script on an empty file and on a name with spaces before I ran the checker. Errors go to standard error. I can say what every part of my pipeline does.
- **Compare with GPIS:** (1) Open `scripts/` in the read-only copy. Pick one script. What does it exit with when it finds a problem, and who reads that? (2) GPIS checks run in CI, not by hand. What would happen to the project if one of them always exited 0?
- **Mastery (lesson closed):** (1) From `access.log`, print the three addresses with the most requests of any kind. (2) Print how many `POST` requests failed. (3) Write, from an empty file, a script that prints `usage` to standard error and exits 1 when it gets no argument; prove the exit code. (4) Explain to a classmate why `uniq -c` needs `sort`, with a three-line example.

### Check plan (`m1-p2`, version 1.0.0, `lab: root ~/academy-labs/m1-p2/logs, seed fixtures/seed.sh`, `requires [wsl]`)

| Step id | Kind | Req. | Verifies |
| :--- | :--- | :--- | :--- |
| `script-exists` | files | yes | `report.sh` is a file, `mode_any_of: ["700","750","755"]` |
| `log-untouched` | files | yes | `access.log` `sha256_of: fixtures/access.log` (the seed copies the same fixture) |
| `normal-log` | tests (run) | yes | `./report.sh access.log` → exit 0, `expect_stdout` the five lines above |
| `odd-name` | tests (run) | yes | `./report.sh "term 1 access.log"` → `"3 404 /favicon.ico\n1 401 /login\n"` |
| `empty-log` | tests (run) | yes | `./report.sh empty.log` → `"no failures\n"`, exit 0 |
| `clean-log` | tests (run) | yes | `./report.sh no-failures.log` → `"no failures\n"`, exit 0 |
| `no-argument` | tests (run) | yes | `./report.sh` → `expect_exit: 1`, `expect_stdout: ""` |
| `missing-file` | tests (run) | yes | `./report.sh not-here.log` → `expect_exit: 2`, `expect_stdout: ""` |
| `answers` | doc | yes | `answers.md`, the three headings, `min_words_per_heading: 20` |

Messages: `script-exists` "report.sh is missing, or you cannot run it as ./report.sh."
`log-untouched` "access.log was changed. A report must never edit the log it reads."
`normal-log` "The report for access.log is not the expected five lines." `odd-name` "The
script gave the wrong report for a file name with spaces." `empty-log` / `clean-log` "A log
with no failures must print exactly: no failures." `no-argument` "With no argument the script
must print nothing on standard output and exit with 1." `missing-file` "For a file that does
not exist the script must print nothing on standard output and exit with 2." `answers`
"answers.md is missing a heading, or a section is too short."

Fixtures: `seed.sh`, `access.log`, `term-1-access.log` (copied to the name with spaces),
`no-failures.log`, `by-address.sh` (debugging lab, see Q1).

### Needs

Unit 1.1. No install. No network.

---

## Unit 1.3 — Processes, signals and ports

### Front matter

| Field | Value |
| :--- | :--- |
| id / project | `m1-u3` / `m1-p3` |
| title | Processes, signals and ports |
| module / position | 1 / 3 |
| guidance | guided |
| minutes | 780 |
| gpis_part | What runs when GPIS runs: the dev server, its port, and how to stop it cleanly |
| requires | `[wsl, node]` |

### Outcomes

After this unit you can:

1. list processes, read a process tree and say which process started which;
2. stop a process politely with a signal, and say when `KILL` is the wrong first choice;
3. find which process listens on a port and on which address;
4. explain the difference between `127.0.0.1`, another loopback address and `0.0.0.0`;
5. collect evidence (commands and output) before changing anything.

### Lesson

| § | Section | Key ideas |
| :--- | :--- | :--- |
| 1 | A program that is running | Process, PID, parent (PPID). `ps -ef`, `ps -ef --forest`, `pstree -p` |
| 2 | Foreground and background | `&`, `jobs`, `fg`, Ctrl+C, Ctrl+Z. What happens to children when a terminal closes |
| 3 | Signals | `kill -TERM` asks, `kill -KILL` forces. `kill PID`, `pkill -f`, why TERM first: the program can clean up |
| 4 | Children that are never collected | A parent that starts children and never waits; orphans are adopted by PID 1; why the count grows |
| 5 | Ports and addresses | A server listens on address + port. `ss -ltnp`. `127.0.0.1` = this machine only; `0.0.0.0` = every address; "address already in use" |
| 6 | Asking a server | `curl -s`, `curl -i`, `--max-time`. "Connection refused" (nothing listens) is different from "timed out" (nothing answers) |
| 7 | In GPIS | `npm run dev` listens on port 3000; a second copy fails or moves to 3001; stop with Ctrl+C, not by closing the window |

- **Diagram:** a process tree in text: `bash → start.sh → node server.mjs` and `bash → leaky.sh → sleep, sleep, sleep`.
- **Common mistakes**
  1. `kill -9` first → the program cannot save or close files → `TERM`, wait, then `KILL` only if needed.
  2. Killing the children, not the parent → new children appear → find the parent in the tree.
  3. Reading `ss` output without `-p` → no process name → `ss -ltnp`.
  4. "It listens, so it works" → it listens on the wrong address → read the address column too.
  5. `pgrep -f name` inside a script matches the script itself → use `pgrep -x`, or the `[n]ame` form.

### Guided example — "Start, find, ask, stop"

Folder `~/academy-labs/scratch/u1-3/`.

1. Write a five-line `hello-server.mjs` (given) that answers `hello` on `127.0.0.1:8085`.
2. Start it with `node hello-server.mjs &`; `jobs`; note the PID.
3. `ps -ef --forest | grep -A1 bash` → see it under your shell.
4. `ss -ltnp | grep 8085` → address, port, PID.
5. `curl -s http://127.0.0.1:8085/` → `hello`. Then `curl` port 8086 → "Connection refused".
6. Start a second copy → "address already in use". Read the message; do not fix by changing the port.
7. `kill PID`; `jobs` shows "Terminated"; `ss` shows nothing; `curl` is refused.
8. Start `sleep 300 &` three times from a small script that exits; show with `ps -ef` that their parent is now PID 1 (or the WSL init).

What you just used: `ps`, `pstree`, `jobs`, `kill`, `ss`, `curl`, `&`.

### Quiz plan (`m1-u3-quiz`, 7 questions, pass mark 5)

| # | Idea | Right answer | Wrong options and why |
| :--- | :--- | :--- | :--- |
| 1 | Predict: a server listens on `127.0.0.1:8080`. A phone on the same Wi-Fi opens `http://<laptop address>:8080` | Cannot connect | "Works, same network" (loopback is this machine only); "Works but slowly"; "Asks for a password" (no such step) |
| 2 | Which signal first, to stop a program that may be writing a file? | `TERM` | `KILL` (cannot be handled; the file may be half written); `STOP` (pauses, does not end); `HUP` (many programs reload on it) |
| 3 | Predict: you kill three `sleep` children of `leaky.sh`, the parent still runs. One minute later? | New children exist | "All gone" (the parent makes more); "The parent stops by itself" (nothing told it to); "The children come back with the same PIDs" (PIDs are new) |
| 4 | `curl` says "Connection refused". Most likely? | Nothing listens on that address and port | "The server is slow" (that gives a timeout); "DNS failed" (the message would say "could not resolve"); "Wrong password" (HTTP would answer 401) |
| 5 | Find the mistake: `ss -ltn` shows `127.0.0.2:8081`; the note says "server is up on 8080" | Both the address and the port are different from what was asked | "Only the port is wrong"; "`ss` shows clients, not servers" (`-l` shows listeners); "Nothing is wrong" |
| 6 | What is the parent of a process whose parent has exited? | PID 1 (the init process) adopts it | "It has no parent"; "The shell that is open now"; "It is ended at once" (it keeps running) |
| 7 | GPIS: `npm run dev` says port 3000 is in use. Best first step? | Find which process holds 3000 (`ss -ltnp`) and decide whether to stop it | "Restart the computer" (works, teaches nothing); "Change the app to port 3001 for good" (hides the old copy); "`kill -9` every node process" (may kill other work) |

### Lab — project 1.3 Processes and ports (lab project)

- **Start:** `npx academy init m1-p3` → `~/academy-labs/m1-p3/office-server`, then `./start.sh`.
- **Situation:** the office status server "is running" but nobody can open it, and the laptop
  gets slower every hour.

**Seed writes:**

| Path | Contents |
| :--- | :--- |
| `server.mjs` | About 25 lines of Node (no packages). Reads `server.conf` (`host=`, `port=`), listens there, answers `ok` + newline on `/health`, 404 elsewhere. Writes its PID to `server.pid` |
| `server.conf` | `host=127.0.0.2` and `port=8081` (two wrong values) |
| `leaky.sh` | A loop: every 2 seconds starts `sleep 6001 &` and never waits |
| `start.sh` | Starts `leaky.sh` and `node server.mjs` in the background with `nohup`, prints "started". Refuses to start a second copy if `server.pid` names a live process |
| `README.txt` | "The server must answer on 127.0.0.1 port 8080 at /health." |
| `evidence.md` | The four headings below, empty |

**What done means**

| # | Requirement | Step |
| :--- | :--- | :--- |
| 1 | `evidence.md` shows the process tree **before** you stopped anything | `evidence` |
| 2 | `leaky.sh` is not running, and none of its `sleep 6001` children are | `leak-stopped`, `children-gone` |
| 3 | You stopped them with `TERM`, and wrote the commands down | `evidence` (self-review for the signal) |
| 4 | `server.conf` holds `host=127.0.0.1` and `port=8080`, nothing else changed | `conf-fixed` |
| 5 | The server answers `ok` at `http://127.0.0.1:8080/health` | `health-answers` |
| 6 | Nothing listens on the old address and port | `old-port-closed` |
| 7 | `server.mjs`, `leaky.sh` and `start.sh` are unchanged | `code-untouched` |

**Steps (guided):** (1) run `./start.sh`; (2) try `curl` on the address in `README.txt`, note
the error; (3) save the process tree into `evidence.md`; (4) save the listening sockets;
(5) find the parent of the `sleep` processes; (6) stop the parent, then the children, with
`TERM`; prove they are gone; (7) read `server.conf`, edit it with `nano`; (8) stop the server
with the PID in `server.pid`; start it again with `node server.mjs &`; (9) `curl` again;
(10) finish `evidence.md`.

**Hints:** (a) `ps -ef --forest` draws the tree; `grep -B2 sleep` shows the lines above a
match. (b) `pkill` can choose by parent: read `man pkill` for `-P`. (c) A changed config is
read only when the program starts.

**Finished state:** server running under the learner's shell on `127.0.0.1:8080`; no
`leaky.sh`, no `sleep 6001`; `server.conf` equal to `fixtures/server.expected.conf`;
`evidence.md` with `## Process tree`, `## Listening sockets`, `## Signals I sent`,
`## What was wrong`, at least 20 words each.

### Debugging lab — "Address already in use"

| Item | Design |
| :--- | :--- |
| Seeded | `app.mjs` (answers `app ok` on `127.0.0.1:8090`, writes `app.pid`), `run.sh` (starts `app.mjs`), `stop.sh` (reads `app.pid`, sends TERM, prints "stopped"), `setup.sh` (the learner runs it once: it starts an old copy of the app under another name, `node old-app.mjs`, on 8090, then writes a PID that is not in use into `app.pid`) |
| Symptom | "`./run.sh` fails with `EADDRINUSE`. I ran `./stop.sh`, it said stopped, and it still fails." |
| Fault 1 | An old copy (`old-app.mjs`) holds port 8090 |
| Fault 2 | `app.pid` is stale, and `stop.sh` prints "stopped" even when `kill` fails (it ignores the exit code) |
| Evidence | Observe: the exact error line. Causes: another program on 8090; the app starts twice inside `run.sh`; the port needs root. Tests: `ss -ltnp \| grep 8090`; `cat app.pid` then `ps -p`; `grep -n listen app.mjs`. Cause: old copy + stale PID file. Fix: TERM the old copy; make `stop.sh` say "not running" and exit 1 when the PID is not alive (2–3 lines) |
| Fixed state | `./run.sh` then `curl -s http://127.0.0.1:8090/` prints `app ok`; `./stop.sh` then `./stop.sh` again: the second prints `not running` and exits 1; no `old-app.mjs` process |

### Own build — port check

In `~/projects/gpis-rebuild`:

1. `scripts/port-check.sh PORT` prints `free` and exits 0 when nothing listens on that port.
2. When something listens, it prints `in use: PID COMMAND ADDRESS` and exits 1.
3. No argument, or an argument that is not a number from 1 to 65535 → usage on standard
   error, exit 2.
4. It never stops a process. It only reports.
5. `notes/unit-1-3.md`: the output for port 3000 with and without a server running.

### Review

- **Checklist extras:** I saved the evidence before I stopped anything. I used `TERM` first. I can read the address and the port in `ss` output.
- **Compare with GPIS:** (1) Read `package.json` in the read-only copy. Which command starts the dev server, and which port does it use? Where could that port be changed? (2) GPIS's rule says "Never change working code merely to make an error message disappear." How would changing the port break that rule in the debugging lab?
- **Mastery:** (1) Start any server on port 8123, then show three facts about it: PID, parent, listening address. (2) Stop it without `kill -9` and prove the port is free. (3) Explain "Connection refused" against "timed out" with one command for each. (4) Draw the process tree of your terminal now.

### Check plan (`m1-p3`, version 1.0.0, `lab: root ~/academy-labs/m1-p3/office-server`, `requires [wsl, node]`)

| Step id | Kind | Req. | Verifies |
| :--- | :--- | :--- | :--- |
| `code-untouched` | files | yes | `server.mjs`, `leaky.sh`, `start.sh` each `sha256_of` their fixture |
| `conf-fixed` | files | yes | `server.conf` `sha256_of: fixtures/server.expected.conf` |
| `evidence` | doc | yes | `evidence.md`, the four headings, `min_words_per_heading: 20` |
| `leak-stopped` | tests (run) | yes | `pgrep -f '[l]eaky.sh'` → `expect_exit: 1` |
| `children-gone` | tests (run) | yes | `pgrep -f '[s]leep 6001'` → `expect_exit: 1` |
| `health-answers` | tests (run) | yes | `curl -s --max-time 3 http://127.0.0.1:8080/health` → `"ok\n"` |
| `old-port-closed` | tests (run) | yes | `curl -s --max-time 3 http://127.0.0.2:8081/health` → `expect_exit: 7` (curl's "could not connect") |
| `tree-recorded` | tests (run) | yes | `grep -c 'leaky.sh' evidence.md` → exit 0 (the tree in the evidence names the leaking script) |

Messages: `code-untouched` "A program file was changed. Only server.conf needs an edit."
`conf-fixed` "server.conf is not the expected two lines." `evidence` "evidence.md is missing
a heading, or a section is too short." `leak-stopped` "leaky.sh is still running."
`children-gone` "Some sleep 6001 processes started by leaky.sh are still running."
`health-answers` "Nothing answered ok at http://127.0.0.1:8080/health. Is the server running
with the new settings?" `old-port-closed` "Something still listens on 127.0.0.2 port 8081."
`tree-recorded` "The process tree in evidence.md does not show leaky.sh. Record the tree
before you stop anything."

Fixtures: `seed.sh`, `server.mjs`, `leaky.sh`, `start.sh`, `server.conf`,
`server.expected.conf`; for the debugging lab: `app.mjs`, `old-app.mjs`, `run.sh`, `stop.sh`,
`setup.sh`.

### Needs

Units 1.1–1.2. `curl` (in Ubuntu by default; `lab.md` shows `sudo apt install curl`). The
learner starts the processes; the seed starts nothing. No network.

---

## Unit 1.4 — Git: a history you can trust

### Front matter

| Field | Value |
| :--- | :--- |
| id / project | `m1-u4` / `m1-p4` |
| title | Git: a history you can trust |
| module / position | 1 / 4 |
| guidance | guided |
| minutes | 900 |
| gpis_part | The commit history of GPIS: small commits, one topic each, no secret ever committed |
| requires | `[wsl, git]` |

### Outcomes

After this unit you can:

1. explain commit, branch, HEAD, staging area and working tree with a drawing;
2. make small commits with messages that say what changed and why;
3. merge a branch and resolve a conflict by reading both sides;
4. find and bring back a commit that no branch points to;
5. keep a secret file out of history with `.gitignore`, and say why deleting it later is not enough.

### Lesson (two parts)

| § | Section | Key ideas |
| :--- | :--- | :--- |
| A1 | What Git stores | Snapshots, not differences. A commit = snapshot + parent + message. `git log --oneline --graph --all` |
| A2 | Three places | Working tree, staging area, repository. `status`, `add -p`, `commit`, `diff`, `diff --staged` |
| A3 | Good commits | One topic. Message: what and why, in the present tense. Bad: "fix", "update", "wip" |
| A4 | Branches are names | A branch is a movable name for a commit. `switch -c`, `branch`, HEAD |
| A5 | Ignoring files | `.gitignore`; `.env`; "ignored" does not remove what is already committed |
| B1 | Merging | Fast-forward and merge commit. `git merge --no-ff` |
| B2 | Conflicts | Why they happen (same lines, two changes). The markers. Read both, write the right text, `add`, `commit`. `merge --abort` |
| B3 | Nothing is lost quickly | `git reflog`. A commit with no branch still exists for weeks. `git branch name <sha>`, `cherry-pick` |
| B4 | Rewriting history | `commit --amend`, `reset --hard`, force-push: what they destroy; the rule "never rewrite what others have" |
| B5 | In GPIS | Small commits; `.env.local` never committed (security rule 7); CI searches for secret keys |

- **Diagram (Mermaid `gitGraph`):** `main` with three commits, a branch with two, a merge commit; a dotted note "deleted branch: commit still exists".
- **Common mistakes**
  1. `git add .` without `git status` → a secret or a huge folder is committed → read `status` first.
  2. Choosing "mine" or "theirs" for the whole file in a conflict → one person's work is lost → read both sides line by line.
  3. Leaving conflict markers in the file → the file is committed broken → search for `<<<<<<<` before `add`.
  4. Deleting a committed secret in a new commit → it is still in history → the key must be changed (rotated); history rewriting is a last step.
  5. `reset --hard` to "start again" → uncommitted work is gone for good → commit or stash first.

### Guided example — "Two people, one file"

Folder `~/academy-labs/scratch/u1-4/` (a new repository; you play both people).

1. `git init`, set `user.name` / `user.email` for this repository only, first commit of `timetable.md`.
2. Branch `add-friday`; add a Friday line; commit.
3. Back on `main`; change the Monday line; commit. Draw the graph with `log --graph --all`.
4. `git merge add-friday` → clean merge commit. Read it with `git show`.
5. Make a real conflict: both branches change the Tuesday line. Merge; read the markers;
   write the combined line; `add`; `commit`.
6. Make a commit on a branch `idea`; switch to `main`; `git branch -D idea`; show it is gone
   from `log --all`.
7. `git reflog`; find the commit; `git branch idea-back <sha>`; `git log idea-back`.
8. Create `.env` with a made-up value; `status` shows it; add `.env` to `.gitignore`; `status`
   no longer shows it; `git check-ignore -v .env`.

What you just used: `init add commit status diff log switch branch merge reflog check-ignore`.

### Quiz plan (`m1-u4-quiz`, 8 questions, pass mark 6)

| # | Idea | Right answer | Wrong options and why |
| :--- | :--- | :--- | :--- |
| 1 | What is a branch? | A name that points to one commit | "A copy of all files" (no copy is made); "A folder on disk"; "A list of all commits by one person" |
| 2 | Predict: you delete branch `houses` (never merged) with `-D`. Its last commit is… | still stored, findable with `git reflog` | "deleted at once" (Git keeps it for weeks); "moved to main"; "in the recycle bin of Windows" |
| 3 | Find the mistake: a file contains `<<<<<<< HEAD` and was committed | The conflict was not resolved; the markers must be removed and the right text written | "That is how Git marks a merge for ever"; "It only needs `git push`"; "The file is binary" |
| 4 | Predict: `.env` was committed last week. Today you add `.env` to `.gitignore` and commit | Git still tracks `.env`, and the old value is still in history | "It is removed from history"; "Git now refuses to open the repository"; "It is removed from disk" |
| 5 | Which message is best? | "Reject marks above the stored maximum" | "fix" (says nothing); "Updated files" (which, why?); "asdf" |
| 6 | Predict: `main` has not moved since `topic` was made. `git merge topic` on main gives | A fast-forward: `main` moves to `topic`'s commit, no merge commit | "Always a merge commit"; "A conflict"; "An error: nothing to merge" |
| 7 | You have uncommitted work and run `git reset --hard`. What happens to that work? | It is gone; reflog cannot bring back what was never committed | "It is in the reflog"; "It is in the staging area"; "It moves to a new branch" |
| 8 | GPIS: a real key was pushed in a commit. What must happen first? | Change (rotate) the key, because anyone with the history has it | "Delete the file in a new commit" (history keeps it); "Make the repository private" (already copied); "Add it to `.gitignore`" (too late) |

### Lab — project 1.4 Git rescue (lab project)

- **Start:** `npx academy init m1-p4` → `~/academy-labs/m1-p4/school-notes` (a Git repository).
- **Situation:** two colleagues edited the term notes. One branch does not merge cleanly, a
  branch with finished work was deleted by mistake, and a file with a password is lying in
  the folder.

**Seed builds the repository** with fixed author (`Lab Seed <seed@example.invalid>`) and
fixed dates (`GIT_AUTHOR_DATE` / `GIT_COMMITTER_DATE`), so every run gives the same history:

| Item | Contents |
| :--- | :--- |
| `main`, 4 commits | "Add the term notes file" (`terms.md`: three lines, one per term, with dates), "Add the class list" (`classes.md`), "Correct the Term 1 opening date" (changes line 1 of `terms.md` to `Term 1: 14 September 2026 to 18 December 2026`), "List the public holidays" (`holidays.md`) |
| `fix/term-dates`, 2 commits, branched after commit 2 | "Add the mid-term break to Term 1" (line 1 becomes `Term 1: 7 September 2026 to 18 December 2026 (mid-term break 26 to 30 October)`), "Correct the Term 2 closing date" (line 2) |
| Lost work | Branch `feature/houses` with one commit "Add the four houses" (`houses.md`: `House 1` … `House 4`, one per line), then deleted with `git branch -D`. Only the reflog knows it |
| Untracked | `.env` containing `ADMIN_TOKEN=sb_secret_` + 24 made-up characters (a fake that matches the checker's secret pattern). No `.gitignore` |
| `TASK.md` (untracked) | The requirements, and this sentence: "Term 1 opens on 14 September 2026. The mid-term break is correct." |

**What done means**

| # | Requirement | Step |
| :--- | :--- | :--- |
| 1 | `fix/term-dates` is merged into `main` with a merge commit | `one-merge` |
| 2 | `terms.md` line 1 reads `Term 1: 14 September 2026 to 18 December 2026 (mid-term break 26 to 30 October)`; line 2 has the corrected Term 2 date; no conflict markers | `terms-final`, `no-markers` |
| 3 | `houses.md` is on `main`, with the content of the lost commit | `houses-back` |
| 4 | All six seeded commits are still in the history of `main` (nothing rewritten) | `history-kept` |
| 5 | `.env` is ignored and was never committed | `env-ignored`, `env-not-tracked`, `history` |
| 6 | `.gitignore` is committed | `gitignore-tracked` |
| 7 | Your own commits have messages of 15 characters or more that say what changed | `history` |
| 8 | The working tree is clean and you are on `main` | `clean-tree`, `on-main` |

**Steps (guided):** (1) look: `status`, `log --oneline --graph --all`; read `TASK.md`;
(2) deal with `.env` first: `.gitignore`, commit it; (3) `git merge fix/term-dates`; read the
conflict; (4) write line 1 as `TASK.md` says; check line 2; search for markers; `add`;
`commit`; (5) `git reflog`; find "Add the four houses"; (6) make a branch at that commit and
merge it (or `cherry-pick` it); (7) `log --graph`; (8) `status` is clean.

**Hints:** (a) `git log --all` does not show commits that no branch points to; `git reflog`
does. (b) In a conflict, the part above `=======` is your branch. (c) `git diff --check`
finds leftover markers.

**Finished state:** `main` holds at least 9 commits (6 seeded + `.gitignore` + merge + the
houses work); `terms.md` equals `fixtures/terms.expected.md`; `houses.md` equals
`fixtures/houses.md`; `.env` on disk, ignored, untracked; `TASK.md` either ignored, deleted
or committed (not checked).

### Debugging lab — "My two commits vanished"

| Item | Design |
| :--- | :--- |
| Seeded | A repository `timetable/` with 3 commits on `main`; then HEAD detached at commit 2, two more commits made there ("Add the Friday assembly", "Move sports to Wednesday"), then `git switch main`. Also `.gitignore` containing `notes/`, and an untracked `notes/meeting.md` |
| Symptom | "I made two commits this morning. `git log` does not show them." Then: "`git add notes/meeting.md` does nothing useful; Git says the path is ignored." |
| Fault 1 | The commits were made on a detached HEAD; no branch points to them |
| Fault 2 | `.gitignore` ignores the whole `notes/` folder |
| Evidence | Observe: `git log --oneline` output. Causes: commits on another branch; commits never made; commits on a detached HEAD. Tests: `git branch -a`; `git reflog` (shows "checkout: moving from <sha> to main"); `git status`. Fix 1: `git branch morning-work <sha>` and merge it. Fix 2: `git check-ignore -v notes/meeting.md` names the line; remove that line and commit `.gitignore` |
| Fixed state | `main` contains both lost commits (same subject lines); `notes/meeting.md` is tracked; nothing was force-deleted or reset |

### Own build — `gpis-rebuild` becomes a repository

In `~/projects/gpis-rebuild`:

1. It is a Git repository on branch `main` with your real name and email set for this repository.
2. `.gitignore` ignores `.env`, `.env.*`, `node_modules/` and `notes/private/`; `.env.example` is **not** ignored.
3. What exists so far (`docs/commands.md`, `scripts/*.sh`) is committed in at least three commits, one topic each.
4. A branch `docs/git-notes` adds `docs/git.md` (your own ten-line Git guide) and is merged with a merge commit.
5. You made and resolved one conflict on purpose in `docs/commands.md`; the history shows it.
6. `notes/unit-1-4.md`: the graph (`git log --oneline --graph`) pasted, with one sentence per commit saying why it is separate.

### Review

- **Checklist extras:** I read `git status` before every `git add`. I resolved the conflict by reading both sides. I did not use `reset --hard` or `push --force`. I can draw my history.
- **Compare with GPIS:** (1) Run `git log --oneline | head -30` in the read-only copy. Pick three messages. What do they have in common? (2) Run `git log --stat -3`. How many files does a typical commit touch, and why does that help the person who reviews it? (3) GPIS's `.env.example` holds names and no values. Why is that file committed when `.env.local` never is?
- **Mastery:** (1) In a new repository, make a conflict on purpose and resolve it; show the graph. (2) Delete an unmerged branch and bring its commit back. (3) Explain, with a drawing, the difference between the staging area and a commit. (4) Say what you would do in the first ten minutes after pushing a real password.

### Check plan (`m1-p4`, version 1.0.0, `lab: root ~/academy-labs/m1-p4/school-notes`, `requires [wsl, git]`)

| Step id | Kind | Req. | Verifies |
| :--- | :--- | :--- | :--- |
| `terms-final` | files | yes | `terms.md` `sha256_of: fixtures/terms.expected.md` |
| `houses-back` | files | yes | `houses.md` `sha256_of: fixtures/houses.md` |
| `no-markers` | tests (run) | yes | `grep -rlE '^(<<<<<<<\|=======\|>>>>>>>)' --include='*.md' . ; true` → `expect_stdout: ""` |
| `on-main` | tests (run) | yes | `git branch --show-current` → `"main\n"` |
| `one-merge` | tests (run) | yes | `git log --merges --format=%p main \| wc -l \| tr -d ' '` → at least one merge whose second parent is the seeded tip of `fix/term-dates`: command `git merge-base --is-ancestor fix/term-dates main` → exit 0, **and** `git rev-list --merges --count main` output is not `0` (two commands joined with `&&`, the second as `test "$(git rev-list --merges --count main)" -ge 1`) |
| `history-kept` | tests (run) | yes | For each of the six seeded subject lines: `git log --format=%s main \| grep -cxF "<subject>"` is 1. One command: a `for` loop over the six subjects that exits 1 on the first one missing |
| `env-ignored` | tests (run) | yes | `git check-ignore -q .env` → exit 0 |
| `env-not-tracked` | tests (run) | yes | `git log --all --format=%H -- .env \| wc -l \| tr -d ' '` → `"0\n"` |
| `gitignore-tracked` | tests (run) | yes | `git ls-files --error-unmatch .gitignore` → exit 0 |
| `clean-tree` | tests (run) | yes | `git status --porcelain --untracked-files=no` → `expect_stdout: ""` |
| `history` | git | yes | `min_commits: 9`, `message_min_chars: 15`, `forbidden_messages: ["fix", "update", "wip", "changes", "merge"]`, `no_secrets: true` |

Note for the builder: check how the `git` step's `forbidden_messages` treats the default
merge message ("Merge branch 'fix/term-dates'"); it must be allowed. If the step compares
whole messages, "merge" in the list only forbids a message that is exactly that word.

Messages: `terms-final` "terms.md is not the expected text. Read TASK.md again: which
opening date is right, and is the mid-term break kept?" `houses-back` "houses.md is missing
on main, or its content differs from the lost commit." `no-markers` "A file still contains
conflict markers." `on-main` "You are not on the main branch." `one-merge` "fix/term-dates is
not merged into main with a merge commit." `history-kept` "A commit that was in the
repository at the start is no longer in the history of main. History must not be rewritten."
`env-ignored` ".env is not ignored." `env-not-tracked` ".env appears in the history."
`gitignore-tracked` ".gitignore is not committed." `clean-tree` "There are changes that are
not committed." `history` "The history has too few commits, a message that says too little,
or a secret."

Fixtures: `seed.sh`, `terms.expected.md`, `houses.md`; the debugging lab's seed (see Q1).

### Needs

Units 1.1–1.3. Git installed. No network, no GitHub account yet.

---

## Unit 1.5 — How the web works: one request's journey

### Front matter

| Field | Value |
| :--- | :--- |
| id / project | `m1-u5` / `m1-p5` |
| title | How the web works: one request's journey |
| module / position | 1 / 5 |
| guidance | guided |
| minutes | 840 |
| gpis_part | The path of the GPIS sign-in request: browser, DNS, TLS, Vercel, the Next.js app, Supabase |
| requires | `[wsl, git]` |

**Blocked by [Q9]:** which site the learner traces. The unit says "the target site"
everywhere; the answer to Q9 gives its address. Nothing else changes.

### Outcomes

After this unit you can:

1. name every hop between typing an address and seeing a page, in order;
2. show evidence for each hop with a command (`dig`, `curl -v`, `openssl s_client`);
3. read an HTTP request and response: method, path, status, headers, body;
4. say where a cache can sit at each hop and what it would hide;
5. tell from a symptom which hop probably failed.

### Lesson (two parts)

| § | Section | Key ideas |
| :--- | :--- | :--- |
| A1 | Clients and servers | Request and response. URL parts: scheme, host, port, path, query |
| A2 | Finding the server: DNS | Name → address. Resolver, record types A / AAAA / CNAME, TTL. `dig +short`, `dig` |
| A3 | Connecting: TCP | Address + port; the handshake in one sentence; ports 80 and 443 |
| A4 | Trusting: TLS | Certificate, who signed it, which names it covers, expiry. What HTTPS protects and what it does not. `openssl s_client -connect host:443 -servername host` |
| A5 | Speaking: HTTP | Methods GET / POST. Status families 2xx 3xx 4xx 5xx. Headers: `content-type`, `set-cookie`, `cache-control`, `location`. `curl -sI`, `curl -v` |
| B1 | The edge | A hosting platform (Vercel) answers first: TLS ends there, static files come from its cache, the rest goes to a function |
| B2 | The app | The Next.js server builds the page or runs an action; it reads the cookie to know who you are |
| B3 | The database | The app asks Supabase (PostgreSQL) over the network; the database decides which rows this user may see |
| B4 | Back to the browser | HTML, then CSS / JS requests, then rendering. Cookies stored. The browser cache |
| B5 | Caches at every hop | Browser cache, DNS cache (TTL), edge cache (`cache-control`, `age`, `x-vercel-cache`), app data cache; what each hides when stale |
| B6 | In GPIS | Sign-in is a POST handled on the server; the session lives in a cookie; pages with private data are not cached at the edge |

- **Diagram (Mermaid `sequenceDiagram`):** Browser → DNS resolver → Edge (TLS) → App function → Database → back, with a note "cache?" on each arrow.
- **Common mistakes**
  1. "The site is down" for every error → no hop is named → read the exact message: resolve, connect, certificate, status.
  2. Testing only in the browser → its cache hides the change → repeat with `curl`.
  3. Mixing 502 and 500 → 502 means the edge could not get an answer from the app; 500 means the app answered with a failure.
  4. Thinking HTTPS hides the host name → DNS and the TLS server name are visible; path, headers and body are not.
  5. Pasting cookies or tokens into evidence files → a session is leaked → cut them out and write `[removed]`.

### Guided example — "Follow example.com"

Uses `https://example.com` (a public test site kept for this purpose). Folder
`~/academy-labs/scratch/u1-5/`.

1. Install `dig` if missing (`sudo apt install dnsutils`).
2. `dig +short example.com` → addresses. `dig example.com` → find the TTL; run again and watch it fall.
3. `curl -sI https://example.com` → status line and headers; name three headers.
4. `curl -v https://example.com -o /dev/null` → find the lines for: resolved address, connected port, TLS version, certificate subject, request line, status.
5. `openssl s_client -connect example.com:443 -servername example.com </dev/null | openssl x509 -noout -subject -issuer -dates`.
6. `curl -sI http://example.com` (no `s`) → compare: what differs without TLS?
7. `curl -sI https://example.com/nothing-here` → a 404 comes from the server: every earlier hop worked.
8. `curl -sI https://no-such-name.invalid` → "Could not resolve host": the journey stopped at hop 2.

What you just used: `dig`, `curl -sI`, `curl -v`, `openssl s_client`, `openssl x509`.

### Quiz plan (`m1-u5-quiz`, 8 questions, pass mark 6)

| # | Idea | Right answer | Wrong options and why |
| :--- | :--- | :--- | :--- |
| 1 | Order the hops | DNS → TCP → TLS → HTTP request → app → database → response | TLS before DNS (cannot connect to a name not yet resolved); HTTP before TLS (on HTTPS the request is sent inside TLS); database before app (the browser never talks to the database) |
| 2 | `curl: (6) Could not resolve host` — which hop? | DNS | TLS (no connection was tried yet); the app (never reached); the database |
| 3 | Predict: status 302 with `location: /login` | The browser makes a new request to `/login` | "The page is shown and then replaced"; "An error page"; "The server is down" |
| 4 | 502 from the hosting edge means | The edge was reached, but it got no valid answer from the app behind it | "DNS failed" (the edge answered, so DNS worked); "The password is wrong" (that is 401); "The page does not exist" (404) |
| 5 | What does HTTPS hide from someone on the same Wi-Fi? | The path, headers and body, not the host name | "Everything, including which site"; "Only the password field"; "Nothing; it only proves identity" |
| 6 | You changed a page; the browser shows the old one, `curl` shows the new one | The browser cache | DNS cache (both would go to the same server); the database (both read the same rows); TLS |
| 7 | Find the mistake: an evidence file contains a full `set-cookie` session value | A live session was written down; it must be removed | "Cookies are public anyway"; "It is fine because the file is in `docs/`"; "Only passwords are secret" |
| 8 | GPIS: why must a page with a student's scores not be stored in a shared edge cache? | The next visitor could be given another person's page | "It would be too slow"; "Caches cannot store HTML"; "Because scores change every second" |

### Lab — project 1.5 Request journey (repo project)

- **Start:** work in `~/projects/gpis-rebuild`. Evidence goes in `docs/evidence/`.
- **Situation:** you will soon build a sign-in page. First prove you know the road a sign-in
  request travels on a real deployed site built with the same stack (the target site, Q9).
- **Rule:** you only **load** the sign-in page (a GET). You do not sign in from the terminal,
  and you never write a password, cookie or token into a file.

**What done means**

| # | Requirement | Step |
| :--- | :--- | :--- |
| 1 | `docs/request-journey.md` has these headings, in this order: `## Browser`, `## DNS`, `## TCP and TLS`, `## Edge`, `## App server`, `## Database`, `## Response`, `## Diagram` | `journey-doc` |
| 2 | Each of the first seven sections has at least 40 words, and one line that starts `Cache:` saying which cache can sit there and what it would hide | `journey-doc`, `cache-lines` |
| 3 | Each of the first seven sections has one line that starts `Evidence:` naming a file in `docs/evidence/` or saying "none possible from outside, because …" | `evidence-lines` |
| 4 | `docs/evidence/dns.txt` holds the full `dig` output for the target host | `evidence-files`, `dns-real` |
| 5 | `docs/evidence/tls.txt` holds the certificate subject, issuer and dates | `evidence-files`, `tls-real` |
| 6 | `docs/evidence/headers.txt` holds the response headers of the sign-in page | `evidence-files`, `headers-real` |
| 7 | `## Diagram` holds a Mermaid sequence diagram with at least five participants | `diagram` |
| 8 | No cookie value or token is in any evidence file | `no-session` |

**Steps (guided):** (1) make `docs/evidence/`; (2) `dig` → `dns.txt`; (3) the `openssl`
pipeline → `tls.txt`; (4) `curl -sI` on the sign-in page → `headers.txt`; open it and replace
any `set-cookie` value with `[removed]`; (5) write the seven sections, one hop at a time: what
happens, the evidence line, the cache line; (6) for App server and Database, say what you
cannot see from outside and how you know they exist (response headers, the stack named in
`curriculum.md`); (7) draw the diagram; (8) run the checker; (9) commit if `gpis-rebuild` is
already a repository.

**Hints:** (a) Response headers that begin `x-vercel-` or `server:` tell you who answered.
(b) `age` and `cache-control` tell you about the edge cache. (c) You cannot see the database
from outside; that is a finding, not a gap.

**Finished state:** `docs/request-journey.md` and three evidence files as above.

### Debugging lab — "Which hop broke?"

| Item | Design |
| :--- | :--- |
| Seeded | Four captured terminal transcripts (text files, made up but realistic, host `school.example`): `case-a.txt` (`curl: (6) Could not resolve host: schol.example` — a typing mistake in the name), `case-b.txt` (`curl: (60) SSL: no alternative certificate subject name matches target host name 'www.school.example'`), `case-c.txt` (`HTTP/2 502` with `server: Vercel`-style edge headers), `case-d.txt` (`HTTP/2 200`, `age: 86400`, `x-vercel-cache: HIT`, with the complaint "I changed the page yesterday and it still shows the old text") |
| Symptom | For all four the user says only: "The site is broken." |
| Faults | a: wrong host name (DNS hop); b: certificate does not cover that name (TLS hop); c: app did not answer the edge (app hop); d: stale edge cache (response/cache) |
| Evidence | One `diagnosis.md` with the five headings; under each heading four short entries (a–d). Observe: the one line that matters, copied. Possible causes: 3 per case. Tests: the command you would run next (`dig`, `openssl s_client`, the platform's function logs, `curl -sI` twice and compare `age`). Cause: the hop. Fix: who must act (the user, the domain owner, the developer, nobody: wait or purge) |
| Fixed state | Nothing to repair. Done = four hops named correctly, each with its evidence line. (Self-review; an answer key is in the mastery section of `review.md`, folded) |

### Own build — local against deployed

1. In `~/academy-labs/scratch/u1-5-own/`, write a 10-line Node server that answers `/login` with a small HTML page and a `cache-control: no-store` header.
2. Capture `curl -v http://127.0.0.1:<port>/login` into `docs/evidence/local.txt` in `gpis-rebuild`.
3. `notes/unit-1-5.md` has a table: each of the seven hops; "deployed" and "local" columns; what is missing locally and why (no DNS, no TLS, no edge).
4. One paragraph: which bugs can therefore **never** be found on localhost.
5. Add a second route `/logo` with `cache-control: max-age=3600`; show with two `curl -sI` runs how you would know a cache answered.

### Review

- **Checklist extras:** every hop has evidence or a reason there is none. No cookie or token is in my files. I can tell a 404, a 500 and a 502 apart.
- **Compare with GPIS:** (1) In the read-only copy, find where the sign-in form is handled (look under `src/app/` for the login route). Does the browser talk to the database directly, or through the server? How can you tell? (2) GPIS keeps the session in a cookie. Which of your seven hops read or write that cookie?
- **Mastery:** (1) For a site you have never traced, produce DNS, TLS and header evidence in under ten minutes. (2) From memory, draw the seven hops and name one cache at each. (3) Given "`curl` works, the browser shows an error page", list three causes in order of likelihood. (4) Explain why a 502 is not the app's bug report but the edge's.

### Check plan (`m1-p5`, version 1.0.0, no `lab:`, run in `~/projects/gpis-rebuild`, `requires [wsl]`)

| Step id | Kind | Req. | Verifies |
| :--- | :--- | :--- | :--- |
| `evidence-files` | files | yes | `docs/evidence/dns.txt`, `tls.txt`, `headers.txt` are files |
| `journey-doc` | doc | yes | `docs/request-journey.md`; the eight headings; `min_words_per_heading: 40` for the first seven (if the step applies one number to all headings, use 40 and tell the learner the diagram section needs 40 words of Mermaid and caption) |
| `cache-lines` | tests (run) | yes | `grep -c '^Cache: ' docs/request-journey.md` → `"7\n"` |
| `evidence-lines` | tests (run) | yes | `grep -c '^Evidence: ' docs/request-journey.md` → `"7\n"` |
| `dns-real` | tests (run) | yes | `grep -c 'ANSWER SECTION' docs/evidence/dns.txt` → `"1\n"` |
| `tls-real` | tests (run) | yes | `grep -cE '^(subject\|issuer\|notBefore\|notAfter)' docs/evidence/tls.txt` → `"4\n"` |
| `headers-real` | tests (run) | yes | `head -n 1 docs/evidence/headers.txt \| grep -cE '^HTTP/[0-9.]+ [0-9]{3}'` → `"1\n"` |
| `diagram` | tests (run) | yes | `grep -c 'sequenceDiagram' docs/request-journey.md` → `"1\n"` |
| `no-session` | tests (run) | yes | `grep -rilE 'set-cookie: [^[]\|authorization: ' docs/evidence ; true` → `expect_stdout: ""` |

Messages: `evidence-files` "An evidence file is missing in docs/evidence/." `journey-doc`
"docs/request-journey.md is missing a heading, the headings are in another order, or a
section is too short." `cache-lines` "Each of the seven hops needs exactly one line that
starts with Cache:." `evidence-lines` "Each of the seven hops needs exactly one line that
starts with Evidence:." `dns-real` "dns.txt does not look like full dig output." `tls-real`
"tls.txt does not show the certificate's subject, issuer and dates." `headers-real`
"headers.txt does not start with an HTTP status line." `diagram` "The Diagram section has no
Mermaid sequence diagram." `no-session` "An evidence file contains a cookie value or an
authorization header."

### Needs

Units 1.1–1.4. `dnsutils` and `openssl` (install shown in `lab.md`). **Network: yes** (DNS and
HTTPS to the target site and to `example.com`).

---

## Unit 1.6 — A project home

### Front matter

| Field | Value |
| :--- | :--- |
| id / project | `m1-u6` / `m1-p6` |
| title | A project home |
| module / position | 1 / 6 |
| guidance | guided |
| minutes | 960 |
| gpis_part | How the GPIS repository is set up: README, AGENTS.md rules, lint, scripts, `.env.example` |
| requires | `[wsl, git, node]` |

### Outcomes

After this unit you can:

1. set up a Node project with `package.json`, scripts and a lint rule set;
2. write a README that lets a stranger run the project, and a rules file that you follow;
3. write one "verify" script that runs every check and fails loudly;
4. keep school details in one config module and import them;
5. publish the repository to GitHub without publishing a secret.

### Lesson (two parts)

| § | Section | Key ideas |
| :--- | :--- | :--- |
| A1 | What a repository must tell a stranger | README: what, how to run, layout, rules. The reader has ten minutes |
| A2 | Rules you write down | GPIS's `AGENTS.md`: boundary, read-first list, security rules, working style. Why written rules beat remembered ones |
| A3 | `package.json` | `npm init`, `name`, `private`, `type: module`, `scripts`, `devDependencies`; `package-lock.json` is committed; `node_modules/` is not |
| A4 | Lint | A program that reads code for known mistakes. ESLint flat config (`eslint.config.mjs`); `npm run lint`; fix the code, do not switch the rule off |
| A5 | Modules | `export` / `import` in `.mjs`; one config module for facts used in many places |
| B1 | One command to check everything | `scripts/verify.sh`: `set -euo pipefail`; runs lint, then the scripts' own checks; prints `verify ok` last |
| B2 | Why exit codes matter again | CI (module 7) will run exactly this script; green must mean checked |
| B3 | Environment files | `.env` for local values; `.env.example` with names only (GPIS security rule 7); both patterns in `.gitignore` |
| B4 | A remote | GitHub repository, `git remote add`, `push -u`, private first; what a push shows the world |
| B5 | In GPIS | `README.md`, `AGENTS.md`, `docs/`, `scripts/`, `src/config/school.ts`; before saying "it works": lint, build, type check |

- **Diagram:** a text tree of the finished `gpis-rebuild` folder with one line of purpose per entry.
- **Common mistakes**
  1. Committing `node_modules/` → thousands of files in history → ignore it before the first `npm install`.
  2. Turning off a lint rule to get green → the mistake stays → fix the code.
  3. `verify.sh` joined with `;` → a failure in the middle is hidden → `set -e` or `&&`.
  4. The school name typed in three files → one is forgotten when it changes → one config module.
  5. README written once and never run → the steps are wrong → follow your own README in a new folder.

### Guided example — "A tiny project, done properly"

Folder `~/academy-labs/scratch/u1-6/tuck-shop/`.

1. `git init`; `.gitignore` first (`node_modules/`, `.env`, `.env.*`, `!.env.example`); commit.
2. `npm init -y`; set `"private": true`, `"type": "module"`; commit.
3. `src/config/shop.mjs` exports `{ name: "Tuck Shop", opens: "07:30" }`; `scripts/shop-info.mjs` imports it and prints one line; run it; commit.
4. `npm install --save-dev eslint @eslint/js`; write `eslint.config.mjs` (given, 8 lines: recommended rules for `**/*.mjs`); add `"lint": "eslint ."`; run; commit.
5. Break a rule on purpose (an unused variable); `npm run lint` fails; `echo $?`; fix the code.
6. Write `scripts/verify.sh`; show the wrong version with `;` passing after a lint failure, then the right one failing.
7. `.env.example` with `SHOP_PIN=` and a comment; show `git status` ignores `.env` and tracks `.env.example`.
8. Write a four-heading README; follow it in a fresh clone (`git clone . ../tuck-shop-copy`) to prove it.

What you just used: `npm init`, `npm install --save-dev`, `npm run`, ESLint, `export` / `import`, `git clone`.

### Quiz plan (`m1-u6-quiz`, 7 questions, pass mark 5)

| # | Idea | Right answer | Wrong options and why |
| :--- | :--- | :--- | :--- |
| 1 | Which of these is committed? | `package-lock.json` | `node_modules/` (rebuilt by `npm install`); `.env` (holds secrets); `.next/` (build output) |
| 2 | Predict: `verify.sh` is `npm run lint; echo "verify ok"` (no `set -e`) and lint fails | Prints `verify ok`, exit code 0 | "Stops at lint" (`;` runs the next command anyway); "exit code 1" (the last command decides); "prints nothing" |
| 3 | Lint reports an unused variable. Best action? | Remove or use the variable | "Add a comment that switches the rule off" (hides it); "Delete `eslint.config.mjs`"; "Ignore it; lint is only style" (unused code often means a forgotten step) |
| 4 | What belongs in `.env.example`? | Variable names with empty values and a comment | Real values (it is committed); nothing, the file should not exist (then nobody knows what to set); test passwords (still secrets in spirit, and they get copied) |
| 5 | GPIS: where should the school's name be written in code? | Once, in a config module that other files import | In every page that shows it (changes get missed); in the database only (the app needs it before it has a connection); in `README.md` (code cannot import a README) |
| 6 | Find the mistake: README says "run `npm start`"; `package.json` has only `lint` | The README was never tested: the command does not exist | "`npm start` always exists" (only if defined or a `server.js` exists); "README files need no commands"; "`lint` should be renamed `start`" |
| 7 | Predict: `.gitignore` has `.env.*` and no other line about env files. Is `.env.example` committed by `git add .`? | No, it is ignored, until you add `!.env.example` | "Yes, example files are special" (Git has no such rule); "Yes, because it has no secret" (Git does not read it); "Git asks you" |

### Lab — project 1.6 Project home (repo project)

- **Start:** `~/projects/gpis-rebuild` (from unit 1.1; a Git repository from unit 1.4's own
  build. If it is not one yet, `git init` is step 1).
- **Situation:** from the next module on, every unit adds code to this repository. Give it a
  proper home first.

**What done means**

| # | Requirement | Step |
| :--- | :--- | :--- |
| 1 | A Git repository on branch `main` | `on-main`, `history` |
| 2 | `README.md` with `## What this is`, `## How to run`, `## Folder layout`, `## Rules`; at least 25 words each | `readme` |
| 3 | `RULES.md` with `## Boundaries`, `## Before I commit`, `## When something looks wrong`; at least 30 words each. "When something looks wrong" names the six GPIS steps | `rules`, `six-steps` |
| 4 | `package.json`: `private` true, `type` `module`, scripts `lint` and `verify` | `package-shape` |
| 5 | `eslint.config.mjs` exists and `npm run lint` passes | `project-files`, `lint` |
| 6 | `src/config/school.mjs` exports `school` with `name: "Great Pakyiman International School"` and `shortName: "GPIS"` | `school-info` |
| 7 | `scripts/school-info.mjs` prints `Great Pakyiman International School (GPIS)` using that module (the name is typed in no other file under `src/` or `scripts/`) | `school-info`, `one-source` |
| 8 | `scripts/verify.sh` runs lint and `school-info`, prints `verify ok` as its last line, exits 0; exits non-zero when lint fails | `verify-passes` (failure case: self-review) |
| 9 | `.gitignore` covers `node_modules/`, `.env`, `.env.*`; `.env.example` exists and is tracked; `node_modules` and `.env` are not tracked | `project-files`, `nothing-private-tracked`, `example-tracked` |
| 10 | At least 8 commits; messages of 15 characters or more; no secret | `history` |

**Steps (guided):** (1) `git status`; make sure you are on `main`; (2) `.gitignore`; commit;
(3) `npm init`; edit `package.json`; commit; (4) the config module and `school-info.mjs`;
commit; (5) ESLint and the config file; fix what it finds in your old scripts' neighbours
(`.mjs` files only); commit; (6) `scripts/verify.sh`; test the failing case by hand; commit;
(7) `.env.example`; commit; (8) `RULES.md`: write the rules you will follow, in your own
words; commit; (9) `README.md`; then follow it in a fresh clone under `~/academy-labs/scratch/`;
correct it; commit; (10) run the checker.

**Hints:** (a) GPIS's `AGENTS.md` has a section "Engineering discipline"; your rules file may
quote the six steps, with the source. (b) `npm pkg set type=module` edits `package.json` for
you. (c) To prove requirement 7, search: `grep -rn "Pakyiman" src scripts`.

**Finished state:** tree: `README.md`, `RULES.md`, `package.json`, `package-lock.json`,
`eslint.config.mjs`, `.gitignore`, `.env.example`, `src/config/school.mjs`,
`scripts/school-info.mjs`, `scripts/verify.sh` (executable), plus `docs/`, `notes/`,
earlier scripts.

### Debugging lab — "Green, but broken"

| Item | Design |
| :--- | :--- |
| Seeded | A small repository `canteen/`: `package.json` (scripts `lint`, `verify`), `eslint.config.mjs`, `src/menu.mjs` with a real lint error (a variable used before it is defined), `scripts/verify.sh` = `npm run lint` newline `echo "verify ok"` with **no** `set -e`; `node_modules/` committed in the second commit, and `.gitignore` (containing `node_modules/`) added in the third. `npm install` has not been run: `lab.md` tells the learner to run it (network: npm) |
| Symptom | "`./scripts/verify.sh` says `verify ok`, but `node src/menu.mjs` crashes." Then: "`git status` shows hundreds of changed files in `node_modules` although it is in `.gitignore`." |
| Fault 1 | `verify.sh` ignores the exit code of lint |
| Fault 2 | `node_modules/` was committed before it was ignored, so Git still tracks it |
| Evidence | Observe: output of `verify.sh` and `echo $?`. Causes: lint is not run; lint finds nothing; the script hides the failure. Tests: `npm run lint; echo $?`; `bash -x scripts/verify.sh`. Fix 1: `set -euo pipefail` (one line), then fix the code error lint reports. Fault 2 tests: `git ls-files node_modules \| wc -l`; `git check-ignore -v node_modules`; Fix: `git rm -r --cached node_modules` and commit |
| Fixed state | `./scripts/verify.sh` exits 0 and prints `verify ok` only when lint passes; `git ls-files node_modules` prints nothing; `node src/menu.mjs` runs; no lint rule was switched off |

### Own build — publish and one helper

1. A **private** GitHub repository `gpis-rebuild` exists and `main` is pushed (`git status` says "up to date with origin/main").
2. Before the push you ran `git log -p | grep -n "sb_secret\|PASSWORD\|TOKEN"` and wrote the result in `notes/unit-1-6.md`.
3. `scripts/new-note.sh UNIT` (for example `2-1`) creates `notes/unit-2-1.md` with three headings: `## What I built`, `## What surprised me`, `## Compare with GPIS`.
4. It refuses to overwrite an existing note (message on standard error, exit 1), and refuses a unit that is not in the form `N-N` (exit 2).
5. `verify.sh` also runs `bash -n` on every file in `scripts/*.sh` (a syntax check).
6. README "Folder layout" is updated; one commit per requirement.

### Review

- **Checklist extras:** I followed my own README in a fresh clone. `verify.sh` fails when I break lint on purpose. The school name is typed once. Nothing private is tracked.
- **Compare with GPIS:** (1) Read GPIS's `README.md` and `AGENTS.md`. Name two rules there that you did not think of, and say what accident each one prevents. (2) Open `src/config/school.ts` in GPIS. What is in it besides the name? Why does a printed report card make this module important? (3) GPIS says to run lint, build and a type check before saying "it works". Which of the three can your project run today?
- **Mastery:** (1) From an empty folder, in 30 minutes: repository, ignore file, `package.json`, one module, one script that imports it, lint, verify script, README. (2) Explain why `;` and `&&` differ, with a two-line example. (3) Say what would go wrong, step by step, if `.env` were committed and pushed. (4) Explain your `RULES.md` to someone as if they were joining the project.

### Check plan (`m1-p6`, version 1.0.0, no `lab:`, run in `~/projects/gpis-rebuild`, `requires [wsl, git, node]`)

| Step id | Kind | Req. | Verifies |
| :--- | :--- | :--- | :--- |
| `project-files` | files | yes | Files: `README.md`, `RULES.md`, `package.json`, `package-lock.json`, `eslint.config.mjs`, `.gitignore`, `.env.example`, `src/config/school.mjs`, `scripts/school-info.mjs`; `scripts/verify.sh` with `mode_any_of: ["700","750","755"]` |
| `readme` | doc | yes | `README.md`, four headings, `min_words_per_heading: 25` |
| `rules` | doc | yes | `RULES.md`, three headings, `min_words_per_heading: 30` |
| `six-steps` | tests (run) | yes | `grep -ciE 'observe.*isolate.*test.*prove.*document.*move on' RULES.md` → output not `0` (command: `grep -qiE '…' RULES.md`, exit 0). The six words may be on one line or the learner is told to write them on one line |
| `package-shape` | tests (run) | yes | `node -e "const p=require('./package.json'); if(!(p.private===true&&p.type==='module'&&p.scripts&&p.scripts.lint&&p.scripts.verify)) process.exit(1)"` → exit 0 |
| `school-info` | tests (run) | yes | `node scripts/school-info.mjs` → `"Great Pakyiman International School (GPIS)\n"` |
| `one-source` | tests (run) | yes | `grep -rl "Pakyiman" src scripts` → `"src/config/school.mjs\n"` |
| `verify-passes` | tests (run) | yes | `./scripts/verify.sh \| tail -n 1` → `"verify ok\n"`, `timeout_seconds: 120` (and exit 0 of the script itself: run as `set -o pipefail; ./scripts/verify.sh \| tail -n 1`) |
| `nothing-private-tracked` | tests (run) | yes | `git ls-files node_modules .env \| wc -l \| tr -d ' '` → `"0\n"` |
| `example-tracked` | tests (run) | yes | `git ls-files --error-unmatch .env.example` → exit 0 |
| `on-main` | tests (run) | yes | `git branch --show-current` → `"main\n"` |
| `lint` | static | yes | `run: [lint]` |
| `history` | git | yes | `min_commits: 8`, `message_min_chars: 15`, `forbidden_messages: ["fix","update","wip","changes","first commit"]`, `no_secrets: true` |

Messages: `project-files` "A required file is missing, or scripts/verify.sh cannot be run."
`readme` "README.md is missing a heading, or a section is too short." `rules` "RULES.md is
missing a heading, or a section is too short." `six-steps` "RULES.md does not name the six
steps for when something looks wrong, in order." `package-shape` "package.json must be
private, of type module, and have lint and verify scripts." `school-info`
"scripts/school-info.mjs did not print the school's name and short name in the expected
form." `one-source` "The school's name is typed in more than one file, or not in
src/config/school.mjs." `verify-passes` "scripts/verify.sh failed, or its last line is not:
verify ok." `nothing-private-tracked` "node_modules or .env is tracked by Git."
`example-tracked` ".env.example is not committed." `on-main` "You are not on the main
branch." `lint` "npm run lint reports problems." `history` "The history has too few commits,
a message that says too little, or a secret."

### Needs

Units 1.1–1.5. **Network: yes** (`npm install`; GitHub for the own build). A GitHub account is
needed for the own build only; the lab does not need it.

---

## After module 1 the learner has

- `~/projects/gpis-rebuild`: a Git repository with README, rules, lint, `verify.sh`, a config
  module, `docs/request-journey.md`, a notes folder, and (own build) a private GitHub remote.
- Habits the next modules rely on: evidence before change; the five-heading diagnosis; small
  commits; three test inputs; exit codes that tell the truth.
