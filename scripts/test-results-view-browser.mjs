/** T20 at 360px: the checker results on the project page (mockup 04): none, failed, passed, old version. */
import assert from "node:assert/strict";
import { renderView } from "./lib/render-view.mjs";
import { noSideways, withPhone } from "./lib/browser.mjs";
import { formatWhen, stepsOf, toRunViews } from "../apps/web/src/lib/check-runs/read.ts";

let checks = 0;
const ok = (v, label) => { assert.ok(v, label); checks++; };

// Pure rules first.
const steps = [
  { id: "list", kind: "files", title: "The class list is in reports/term-1", required: true, outcome: "pass", reasons: [] },
  { id: "grade", kind: "tests", title: "grade() gives the right remark for every score in the GPIS grading table", required: true, outcome: "fail",
    reasons: ["score 79 → expected \"Higher\", got \"High\"", "score 100 → expected \"Highest\", got an error: TypeError: cannot read properties of undefined (reading 'remark') at grade (src/lib/grading.ts:12:5)"] },
  { id: "lint", kind: "static", title: "eslint and tsc", required: false, outcome: "needs", reasons: ["npm is not installed."] },
];
const row = (id, passed, version, over = {}) => ({ id, passed, commit_sha: "a1b2c3d4e5f6", tree_clean: true, checker_version: "0.1.0",
  created_at: "2026-11-13T19:05:00Z", results: { steps: passed ? steps.map((s) => ({ ...s, outcome: "pass" })) : steps },
  check_definitions: { item_slug: "m2-p1", version }, ...over });
ok(stepsOf({ steps: [{ id: "x", kind: "rm -rf", title: "t", required: true, outcome: "pass", reasons: [] }, ...steps] }).length === 3, "a malformed stored step is left out, never shown");
ok(stepsOf(null).length === 0 && stepsOf({ steps: "x" }).length === 0, "malformed results show no steps");
ok(formatWhen("2026-11-13T19:05:00Z", "Africa/Accra") === "13 Nov, 19:05", formatWhen("2026-11-13T19:05:00Z", "Africa/Accra"));
ok(formatWhen("2026-11-13T19:05:00Z", "Not/A_Zone") === "13 Nov, 19:05 UTC", "an unknown time zone falls back to UTC, and says so");

const current = new Map([["m2-p1", "1.2.0"]]);
const shown = (rows) => toRunViews(rows, current).map((r) => ({ ...r, when: formatWhen(r.recordedAt, "Africa/Accra") }));
const states = {
  none: [],
  failed: shown([row(3, false, "1.2.0", { tree_clean: false }), row(2, false, "1.2.0"), row(1, false, "1.1.0")]),
  passed: shown([row(4, true, "1.2.0"), row(3, false, "1.2.0")]),
  old: shown([row(5, true, "1.1.0")]),
};

const page = async (p, runs) => {
  const html = await renderView("app/(app)/project/[id]/results.tsx", "Results", { runs });
  await p.setContent(html);
};

await withPhone(async (p) => {
  await page(p, states.none);
  ok(await p.getByText("No result yet. Run the command in your terminal.").isVisible(), "none: the empty state");

  await page(p, states.failed);
  ok(await p.getByText("Not passed", { exact: true }).first().isVisible(), "failed: the verdict");
  ok(await p.getByText("13 Nov, 19:05 · check v1.2.0").isVisible(), "failed: time and check version");
  ok(await p.getByText("commit a1b2c3d · with uncommitted changes").isVisible(), "failed: the short commit, and uncommitted changes");
  ok(await p.getByText("score 79 → expected \"Higher\", got \"High\"").isVisible(), "failed: the reason under the failed step");
  ok(await p.getByText("npm is not installed.").isVisible(), "a NEEDS step shows its reason too");
  ok(await p.getByRole("img", { name: "Failed" }).count() === 1 && await p.getByRole("img", { name: "Needs something on your computer" }).count() === 1, "each step's outcome has a text label, not only a colour");
  ok(await p.getByText("(optional)").isVisible(), "an optional step says so");
  ok(await noSideways(p), "failed: a long reason does not scroll sideways at 360px");
  const earlier = p.getByText("Earlier results · 2");
  ok(await earlier.isVisible(), "failed: two earlier results");
  ok((await earlier.boundingBox()).height >= 44, "the Earlier results control is at least 44px");
  await earlier.click();
  ok(await p.getByText("Not passed · earlier version (v1.1.0)").isVisible(), "an earlier run of an older version says so");

  await page(p, states.passed);
  ok(await p.getByText("Passed", { exact: true }).first().isVisible(), "passed: the verdict");
  ok(await p.getByRole("img", { name: "Failed" }).count() === 0, "passed: no failed step");
  ok(await noSideways(p), "passed: no sideways scroll");

  await page(p, states.old);
  ok(await p.getByText("Passed an earlier version (v1.1.0)").isVisible(), "old version: 'passed an earlier version'");
  ok(await p.getByText(/A newer version of this check is published/).isVisible(), "old version: says what to do");
  ok(await p.getByText(/Earlier results/).count() === 0, "one run: no Earlier results");
});

console.log(`Results view: ${checks} checks passed.`);
