/** T07 at 360px with offline data: Continue first, one raised row per module, new-learner state. */
import assert from "node:assert/strict";
import { renderView } from "./lib/render-view.mjs";
import { noSideways, smallTargets, withPhone } from "./lib/browser.mjs";
import { itemLine, moduleRows, nextItem } from "../apps/web/src/lib/progress/summary.ts";
import { OUTLINE } from "./lib/sample-outline.mjs";

let checks = 0;
const props = (progress, isNew) => {
  const next = nextItem(OUTLINE, progress);
  return { next, nextLine: next ? itemLine(next, progress) : "", modules: moduleRows(OUTLINE, progress), isNew };
};

await withPhone(async (page) => {
  await page.setContent(await renderView("components/views/map-view.tsx", "MapView", props({ "m1-u1": "read" }, false)));
  const cont = page.getByRole("link", { name: /1\.1 The terminal and the filesystem/ });
  assert.equal(await cont.getAttribute("href"), "/learn/m1-u1#quiz", "Continue opens the next unfinished item"); checks++;
  const continueTop = (await page.getByRole("heading", { name: "Continue" }).boundingBox()).y;
  const modulesTop = (await page.getByRole("list", { name: "Modules" }).boundingBox()).y;
  assert.ok(continueTop < modulesTop, "Continue comes before the modules"); checks++;
  assert.equal(await page.getByRole("list", { name: "Modules" }).getByRole("link").count(), OUTLINE.length, "one row per module"); checks++;
  assert.equal(await page.getByRole("link", { name: /Command line/ }).getAttribute("href"), "/map/m1"); checks++;
  assert.ok(await noSideways(page), "no sideways scroll"); checks++;
  assert.deepEqual(await smallTargets(page), [], "every target is at least 44px"); checks++;

  await page.setContent(await renderView("components/views/map-view.tsx", "MapView", props({}, true)));
  assert.ok(await page.getByText("Start with Module 1").isVisible(), "new learner sees Start with Module 1"); checks++;
  assert.equal(await page.getByRole("link", { name: "Start" }).getAttribute("href"), "/learn/m1-u1", "one button to the first lesson"); checks++;

  await page.setContent(await renderView("components/views/module-view.tsx", "ModuleView", { module: OUTLINE[0], progress: { "m1-u1": "read" } }));
  assert.equal(await page.getByRole("link").filter({ hasText: /Lesson|Quiz|Project/ }).count(), 6, "a module lists lesson, quiz and project per unit"); checks++;
  assert.ok(await noSideways(page), "module page: no sideways scroll"); checks++;
});
console.log(`Course map (360px): ${checks} checks passed.`);
