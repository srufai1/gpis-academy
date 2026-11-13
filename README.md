# Ruftech Academy

Learn software engineering by rebuilding a real system, step by step.

- **The course** — `content/` (original lessons) and `docs/curriculum.md`.
- **The platform** — `apps/web` (Next.js 16 + Supabase), where lessons, quizzes and
  progress live.
- **The checker** — `packages/checker`, the `academy` CLI that checks your work on your
  own computer and sends a signed result. Your code never leaves your computer.

## Setup

Needs Node 22 or later.

```bash
npm ci
cp .env.example apps/web/.env.local   # then fill in your Supabase URL and publishable key
npm run dev                           # http://localhost:3000
```

## Checks

```bash
npm run lint
npx tsc --noEmit
npm run build
npm test                    # offline tests
npm test -- --with-browser  # also the Playwright tests (after npm run build)
```

## Where things are

| Path | What |
| :--- | :--- |
| `docs/decisions.md` | The decisions this project follows |
| `docs/roadmap.md` | Numbered build tasks |
| `docs/platform.md`, `docs/checker.md` | Design of the platform and the checker |
| `docs/mockups/` | Screen wireframes |
| `content/` | The course |
| `apps/web/` | The platform |
| `packages/shared/`, `packages/checker/` | Shared types; the checker CLI |
| `supabase/` | Configuration and migrations |
| `scripts/` | Offline tests and build scripts |
