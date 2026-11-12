# Guided example — Walk the GPIS repository

You will explore the real GPIS repository with the commands from the lesson. You only read;
you change nothing in it.

**Type every command yourself.** Do not paste. Compare what you see with the expected output.

## Step 1 — Get a copy to read

```bash
mkdir -p ~/reference
```

```bash
cd ~/reference
```

```bash
git clone --depth 1 https://github.com/srufai1/gpis-school-system.git
```

`git clone` copies a repository to your machine. Git is taught in Unit 1.4; here it is only
a way to get the files.

## Step 2 — Where am I, and what is here?

```bash
cd gpis-school-system
```

```bash
pwd
```

Expected: `/home/<you>/reference/gpis-school-system`

```bash
ls
```

Expected (among others): `AGENTS.md  README.md  docs  package.json  scripts  src  supabase`

```bash
ls -a
```

New names appear, such as `.gitignore` and `.git`. Names that start with a dot are hidden
from a plain `ls`.

## Step 3 — Relative and absolute paths

```bash
cd src/app
```

```bash
pwd
```

```bash
cd ../lib
```

You went up one level (`..`) and down into `lib`, in one command.

```bash
ls
```

Each folder here is one area of the school system: `students`, `assessments`, `finance`.

```bash
cd ~/reference/gpis-school-system
```

An absolute path works from anywhere.

## Step 4 — Read a file

```bash
less AGENTS.md
```

Press Space to go down, `q` to leave. Find the section "The temporal model". You will
rebuild that in Module 4.

## Step 5 — Read permissions

```bash
ls -l
```

Find one line that starts with `d` and one that starts with `-`. Say aloud what the owner,
the group and others may do with each. Then check one by number:

```bash
stat -c "%a %n" README.md
```

Expected: `644 README.md` — the owner reads and writes; everyone else only reads.

## Step 6 — Count and find

```bash
ls supabase/migrations | wc -l
```

`|` sends the output of the first command into the second. `wc -l` counts lines. You now
know how many schema changes GPIS has had. Pipes are the subject of Unit 1.2.

## Step 7 — Make the copy read-only

You must never edit this copy. Remove your own write permission, so a mistake fails loudly:

```bash
chmod -R a-w ~/reference/gpis-school-system
```

```bash
touch ~/reference/gpis-school-system/test.txt
```

Expected: `touch: cannot touch ... Permission denied`. That is the result you want.

## What you just used

`mkdir -p` · `cd` with relative, parent and absolute paths · `pwd` · `ls`, `ls -a`, `ls -l` ·
`less` · `stat` · a pipe · `chmod`
