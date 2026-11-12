# Lab — Project 1.1: Find your way

**Level:** guided. **Checker:** `m1-p1`. **Time:** about 90 minutes.

A school office folder has been left in a mess. Paths are wrong, a link is broken, and
permissions let the wrong people read private files. Repair it using only the terminal.

## Start

```bash
npx academy init m1-p1
```

This creates the folder `~/academy-labs/m1-p1/office`. Work inside it.

```bash
cd ~/academy-labs/m1-p1/office
```

To start again at any time, run the `init` command again with `--reset`.

## What "repaired" means

| # | Requirement |
| :--- | :--- |
| 1 | `reports/term-1/class-list.txt` exists. (It is somewhere in the folder, in the wrong place.) |
| 2 | The file `term 2 notes.txt` is inside `reports/term-2/`, with its name unchanged |
| 3 | `current` is a symbolic link that points to `reports/term-2` and works |
| 4 | `finance/fees.csv` can be read and written by its owner, read by its group, and not at all by others |
| 5 | The directory `finance` can be entered by its owner and group only |
| 6 | `scripts/backup.sh` can be run by its owner; others cannot change it |
| 7 | In `settings.conf` the line `term=1` now says `term=2`; nothing else in the file changes |
| 8 | No file named `*.tmp` remains anywhere |
| 9 | `answers.md` exists and answers the three questions below |

## Steps (guided)

1. Look first. Run `ls -la`, then `ls -lR | less` to see everything, including hidden names.
2. Find the lost class list: `find . -name "class-list.txt"`. Move it with `mv`.
3. Move `term 2 notes.txt`. Remember the quotes.
4. Look at the link: `ls -l current`. Remove it with `rm current` and make it again with
   `ln -s`.
5. Fix `finance/fees.csv` with `chmod` and a number. Check with `stat -c "%a" finance/fees.csv`.
6. Fix the `finance` directory. Think about what `x` means on a directory.
7. Fix `scripts/backup.sh`. Run it: `./scripts/backup.sh` should print `backup ok`.
8. Edit `settings.conf` in a terminal editor. Change one line only.
9. Find the temporary files: `find . -name "*.tmp"`. Remove them.
10. Write `answers.md`.

## Questions for `answers.md`

Use these three headings exactly. Two or three sentences each, in your own words.

```text
## Owner, group, others
## Execute on a file and on a directory
## Why the link was broken
```

## Check your work

```bash
npx academy check m1-p1
```

Fix what fails and run it again. Every run is recorded; a failed run costs nothing.

## Compare with GPIS

In your read-only copy of GPIS, run `stat -c "%a %n" scripts/*.sh | head`. Which scripts can
be run? Who may change them? Write one sentence about it at the end of `answers.md`.
