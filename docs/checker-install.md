# Installing the checker

The checker (`academy`) is installed from a **GitHub release**, not from npm. The release holds
one file: `gpis-academy-checker-<version>.tgz`. It contains the bundled CLI and the `check/`
folders only — never a lesson, a quiz or an answer key (`scripts/test-pack.mjs` proves this).

## For the learner

In the project folder, inside WSL:

```bash
npm i -D https://github.com/srufai1/gpis-academy/releases/download/checker-v0.1.0/gpis-academy-checker-0.1.0.tgz
npx academy doctor
```

Needs Node 22.18 or newer. Nothing else is downloaded: the tarball has no dependencies.
Playwright is optional; without it, a `page` step reports "needs" instead of failing.

`npx academy init <task>` creates the lab under `~/academy-labs/<task>/` and writes
`.vscode/tasks.json`, so the check also runs from VS Code's *Run Task* menu.

## For the author: publishing a release

1. Change the version in **both** `packages/checker/src/version.ts` and
   `packages/checker/package.json`. The pack script stops if they differ.
2. Run `npm run lint`, `npx tsc --noEmit` and `npm test`. All must pass.
3. Run `npm run pack:checker`. The file appears in `packages/checker/release/`
   (ignored by Git).
4. On GitHub: *Releases → Draft a new release*, tag `checker-v<version>`, attach the `.tgz`,
   publish.
5. Update the version in the install command above and on the platform's task pages.

## The lab database (Module 4 onwards)

The `sql` step connects with `LAB_DATABASE_URL`, set in the learner's shell. It refuses to run
unless that database has this marker, so it can never touch a real database by mistake:

```sql
create table public.academy_lab (purpose text not null);
insert into public.academy_lab values ('gpis-academy lab');
```

Each `sql` step runs inside a transaction and a scratch schema, then rolls back.
The Module 4 setup unit must create this marker.
