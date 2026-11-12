# Own build — A home for your work

No steps this time. Build it your way, then compare.

## Requirements

1. A directory `~/projects/gpis-rebuild` exists. This is where you will rebuild GPIS.
2. Inside it: `docs/`, `scripts/` and `notes/`.
3. `notes/` is private: only you can enter it or read what is inside.
4. `scripts/hello.sh` prints `ready` when you run it, and only you can change it.
5. `docs/commands.md` is your own cheat sheet: at least ten commands from this unit, each
   with one line in your own words and one example you have run.
6. A symbolic link `~/gpis` points to `~/projects/gpis-rebuild`, so `cd ~/gpis` works.

## Check

```bash
npx academy check m1-u1-own
```

## Then compare with GPIS

Run `ls` in your read-only copy of GPIS and in your new folder.

- Which top-level folders does GPIS have that you do not have yet? Guess what each is for.
- GPIS keeps every schema change in `supabase/migrations/`. Why might one folder with many
  small files be safer than one big file that is edited?

Write your answers in `notes/unit-1-1.md`. You will see in Module 4 whether you were right.
