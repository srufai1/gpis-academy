/** T11 at 360px: the progress table fits, "–" means not yet, Continue is the main action. */
import assert from "node:assert/strict";
import { renderView } from "./lib/render-view.mjs";
import { noSideways, withPhone } from "./lib/browser.mjs";
import { projectFacts } from "../apps/web/src/lib/progress/facts.ts";

const now = new Date("2026-12-10T12:00:00Z");
const ref = (slug, label, title) => ({ slug, label, title, currentVersion: "1.0.0" });
const projects = [
  projectFacts(ref("m1-p1", "1.1", "Find your way"), [{ item_slug: "m1-p1", state: "done", due_on: null, updated_at: "2026-12-01T00:00:00Z" }], [], [], now),
  projectFacts(ref("m1-p2", "1.2", "A very long project title that could push the table wider"), [], [], [], now),
];
let checks = 0;
await withPhone(async (page) => {
  await page.setContent(await renderView("components/views/progress-view.tsx", "ProgressView", {
    modules: [{ slug: "m1", title: "Command line, Git and how the web works", label: "1", projects }],
    projectsDone: 1, quizzesPassed: 1, next: { href: "/learn/m1-u2", label: "1.2 Streams" },
  }));
  assert.ok(await noSideways(page), "the page does not scroll sideways (the table scrolls inside its card)"); checks++;
  assert.equal(await page.getByText("checker not yet").count(), 2, "no checker result shows as 'not yet', not as a fail"); checks++;
  assert.equal(await page.getByRole("link", { name: "Continue: 1.2 Streams" }).getAttribute("href"), "/learn/m1-u2"); checks++;
  assert.equal(await page.getByRole("link", { name: /1\.1 Find your way/ }).getAttribute("href"), "/project/m1-p1", "a row opens the project"); checks++;
});
console.log(`Progress (360px): ${checks} checks passed.`);
