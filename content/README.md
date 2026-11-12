# Course content

Original lessons only (decisions.md, ADR-5). Never copy ALX pages here.

`module-01/unit-01/` is the **template**. Every later unit has the same files:

| File | Step of the unit | Notes |
| :--- | :--- | :--- |
| `unit.md` | (index) | Front matter: id, title, module, position, guidance, minutes, GPIS part |
| `lesson.md` | 1 Lesson | One idea per section; short sentences; under about 150 lines |
| `example.md` | 2 Guided example | Commands to type, with the expected output |
| `quiz.json` | 3 Quiz | 5–8 questions; every wrong answer has a reason |
| `lab.md` | 4 Lab | The project task; steps only if guided; the checker command |
| `debugging-lab.md` | 5 Debugging lab | Something broken on purpose; find the cause first |
| `own-build.md` | 6 Own build | The learner's own version, in `gpis-rebuild` when it fits |
| `review.md` | 7 Review and 8 Mastery check | Self-review checklist, GPIS comparison, questions to answer without notes |
| `check/check.yaml` | (checker) | The check for the lab; `check/fixtures/` holds its seed and data |

Rules:

- Plain English, short sentences. A new term is explained the first time it appears.
- Commands are for WSL 2 (Ubuntu). No Docker unless the unit is marked **[Docker]**.
- Each unit names the part of GPIS it relates to, and ends by comparing with it.
- A check only reads and runs. It never changes the learner's files outside the lab folder.
- Changing anything under `check/` needs a new `version` in `check.yaml`.
