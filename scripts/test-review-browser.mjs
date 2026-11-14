/** T22 at 360px: the self-review page — locked before a pass, the form after it, saved revisions. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderView } from "./lib/render-view.mjs";
import { noSideways, smallTargets, withPhone } from "./lib/browser.mjs";
import { renderMarkdown } from "../apps/web/src/lib/content/markdown.ts";
import { reviewContent } from "../apps/web/src/lib/reviews/content.ts";

let checks = 0;
const ok = (v, label) => { assert.ok(v, label); checks++; };
const content = reviewContent(readFileSync(new URL("../content/module-01/unit-01/review.md", import.meta.url), "utf8"));
const long = "This explanation is long on purpose, with a path like /home/ruf/academy-labs/m1-p1/office/reports/term-2/current that must wrap. ".repeat(6);

const viewProps = (open, revisions) => ({
  projectHref: "/project/m1-p1", label: "1.1", title: "Find your way", open, version: "1.0.0", command: "npx academy check m1-p1",
  introHtml: renderMarkdown(content.intro), masteryHtml: renderMarkdown(content.mastery), reflectionHtml: renderMarkdown(content.reflection), revisions,
});
const formProps = (defaults) => ({ items: content.checklist, compareHtml: renderMarkdown(content.compare), defaults });
const revisions = [
  { revision: 2, when: "14 Nov, 10:05", checklist: content.checklist.map((text, i) => ({ text, checked: i < 4 })), explanation: long, comparison: "Same folders; GPIS has no current link." },
  { revision: 1, when: "13 Nov, 21:40", checklist: content.checklist.map((text) => ({ text, checked: false })), explanation: "First try.", comparison: "Not sure yet." },
];

/** The view with the form put where the page puts it. */
async function show(page, open, revs, defaults) {
  let html = await renderView("components/views/review-view.tsx", "ReviewView", viewProps(open, revs));
  if (open) {
    const form = await renderView("../../../scripts/lib/review-form-fixture.tsx", "ReviewFormFixture", formProps(defaults));
    const inner = form.slice(form.indexOf("<main"), form.lastIndexOf("</main>")).replace(/^<main[^>]*>/, "");
    html = html.replace('<div data-slot="review-form"></div>', () => `<div data-slot="review-form">${inner}</div>`);
    assert.ok(html.includes(inner), "the form is in the page");
  }
  await page.setContent(html);
}

await withPhone(async (page) => {
  // Locked: no passing run of the current version.
  await show(page, false, [], null);
  ok(await page.getByText("Your own check, not a mentor's.").isVisible(), "locked: says it is the learner's own check");
  ok(await page.getByText("Opens after a pass").isVisible(), "locked: says when it opens");
  ok(await page.getByText("npx academy check m1-p1").isVisible(), "locked: says what to run");
  ok(await page.locator("form").count() === 0, "locked: no form");
  ok(await page.getByText("Nothing saved yet.").isVisible(), "locked: no revisions");

  // Open, nothing saved yet.
  await show(page, true, [], { checked: [], explanation: "", comparison: "" });
  ok(await page.getByText("Your own check, not a mentor's.").isVisible(), "open: says it is the learner's own check");
  ok(await page.getByRole("checkbox").count() === 6, "open: the six checklist items of review.md");
  ok(await page.getByRole("checkbox", { name: /I typed the commands myself/ }).isVisible(), "each checkbox has its text as its name");
  for (const name of ["Explain your solution", "Compare with GPIS"]) {
    const box = page.getByRole("textbox", { name: new RegExp(name) });
    ok(await box.getAttribute("maxlength") === "4000" && await box.getAttribute("required") !== null, `${name}: required, at most 4000 characters on the form too`);
  }
  ok(await page.getByText(/What is the same in your/).isVisible(), "the GPIS questions of review.md are shown");
  ok(await page.getByRole("button", { name: "Save self-review" }).isVisible(), "one main button");
  ok((await smallTargets(page)).length === 0, `targets are at least 44px: ${JSON.stringify(await smallTargets(page))}`);
  ok(await noSideways(page), "open: no sideways scroll at 360px");

  // Open, with two revisions: the form starts from the newest; earlier ones stay readable.
  await show(page, true, revisions, { checked: revisions[0].checklist.map((i) => i.checked), explanation: long, comparison: revisions[0].comparison });
  ok(await page.getByRole("checkbox", { checked: true }).count() === 4, "the form starts from the newest revision's ticks");
  ok((await page.getByRole("textbox", { name: /Compare with GPIS/ }).inputValue()) === revisions[0].comparison, "and its text");
  ok(await page.getByText("Revision 2").isVisible() && await page.getByText("Revision 1").isVisible(), "both revisions are listed");
  await page.getByText("Revision 1").click();
  ok(await page.getByText("First try.").isVisible(), "an earlier revision opens, unchanged");
  await page.getByText("Revision 2").click();
  ok(await noSideways(page), "a long explanation wraps: no sideways scroll");
  ok(await page.getByText(/ticked: /).count() > 0, "a saved tick has a text label for screen readers, not only a symbol");
});

console.log(`Self-review page: ${checks} checks passed.`);
