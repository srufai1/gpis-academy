# Debugging lab — "It worked yesterday"

**Rule for every debugging lab:** find the cause before you change anything. Write down what
you see, what you think, and how you tested it. Then make the smallest fix.

## The report

A clerk says: "I cannot open the term report. Yesterday it was fine."

## Start

```bash
npx academy init m1-p1-debug
```

```bash
cd ~/academy-labs/m1-p1-debug/office
```

The clerk runs this, and it fails:

```bash
cat current/report.txt
```

## Your work

Do not fix anything yet. Fill in `diagnosis.md` in that folder:

| Heading | What to write |
| :--- | :--- |
| `## Observe` | The exact command and the exact error message |
| `## Possible causes` | At least three, for example: the file is missing, the link is broken, a permission is wrong |
| `## Tests` | One command per cause that would prove or rule it out, with its output |
| `## Cause` | The one cause the evidence supports |
| `## Fix` | The smallest change, and the command that shows it now works |

There are **two** separate faults. The second one only shows after the first is fixed. Treat
it as a new problem: observe again.

## Check

```bash
npx academy check m1-p1-debug
```

The checker confirms that `cat current/report.txt` works, that nothing else in the folder
changed, and that `diagnosis.md` has the five headings.

## The habit to keep

OBSERVE → ISOLATE → TEST → PROVE → DOCUMENT → MOVE ON. GPIS's own rules file (`AGENTS.md`)
asks the same of everyone who works on it. Changing permissions to `777` "to make the error
go away" would hide the fault and open the folder to everyone.
