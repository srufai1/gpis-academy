# Quality pass (T23)

Date: 14 November 2026. Test: `scripts/test-screens-browser.mjs` (gates in `scripts/lib/quality.mjs`).

## What is checked

Every state below is drawn at **360px**, once in **light** and once in **dark** mode (32 in all).
Each must pass every gate:

| Gate | How it is measured |
| :--- | :--- |
| No sideways scroll | The page is not wider than the 360px screen |
| Targets at least 44px | Every link, button, fold and checkbox row. Links inside lesson text are exempt (WCAG 2.5.8, inline links) |
| One main button | The number of filled (primary) buttons equals the mockup's: 1 or 0 |
| Keyboard | The Tab key reaches every visible link, button, fold and field |
| Contrast AA | Every visible text against its real background, in the drawn colours: 4.5:1, or 3:1 for large text |

| Screen | States |
| :--- | :--- |
| 01 Landing | signed out |
| 02 Course map | new learner · in progress · all started |
| 03 Lesson | not read · read |
| 04 Project task | no result · failed · passed (with a saved review) |
| 05 Progress | new learner · in progress · reviewed |
| Self-review (T22) | before a pass · open |
| Every signed-in page | loading (`app/(app)/loading.tsx`, announced as "Loading") |
| Every data page | error (`PageError`, announced as an alert) |

## Fixes made

1. **Result colours failed contrast in light mode.** "Passed" (green, 2.47:1) and "Not passed"
   (red, 3.81:1) were below 4.5:1. Added a `--success` colour token (light and dark) and use
   `text-success` / `text-destructive`; `--destructive` was darkened in light mode and
   lightened in dark mode. The "needs" icon now uses the muted text colour.
   Files: `app/globals.css`, `app/(app)/project/[id]/results.tsx`.
2. **Mockup 04's main action after a pass was missing.** After a passing run of the current
   check version, **Write self-review** is now the one main button and Copy becomes an
   outlined button; before a pass, Copy stays the main button.
   Files: `app/(app)/project/[id]/review-link.tsx` (new), `app/(app)/project/[id]/page.tsx`,
   `components/copy-command.tsx`.

No other screen needed a change: the others passed every gate the first time.

## Not covered here

- The app shell (top bar, bottom bar, sidebar) has its own test, `test-shell-browser.mjs`.
- Sign-in, sign-up and Me → Devices are not among the five mockups and were not audited.
- Contrast is measured for text only, not for icons or borders.
- The audit draws the page views with test data, not the running site with a real account.
