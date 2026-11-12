/** T10 at 360px: the project page, with the guidance rules for three levels. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderView } from "./lib/render-view.mjs";
import { noSideways, withPhone } from "./lib/browser.mjs";
import { renderMarkdown } from "../apps/web/src/lib/content/markdown.ts";
import { countItems, projectParts, splitSections } from "../apps/web/src/lib/content/sections.ts";

const read = (f) => readFileSync(new URL(`../content/module-01/unit-01/${f}`, import.meta.url), "utf8");
const lab = `${read("lab.md")}\n## Hints\n\n- Look at the link first.\n- Then the permissions.\n`;
let checks = 0;

// Pure rules first.
const sections = splitSections(lab).sections.map((s) => s.heading);
assert.ok(!sections.includes("Owner, group, others"), "'## ' lines inside a code fence are not headings"); checks++;
assert.deepEqual(
  ["guided", "half", "independent"].map((g) => { const p = projectParts(lab, g); return [!!p.steps, !!p.hints]; }),
  [[true, true], [false, true], [false, false]],
  "Steps for guided only; Hints for guided and half guided");
checks++;
assert.equal(countItems(projectParts(lab, "guided").steps.body), 10, "the sample lab has 10 steps"); checks++;
assert.ok(!projectParts(lab, "guided").intro.startsWith("# "), "the lab's own title line is dropped"); checks++;

const props = (guidance) => {
  const p = projectParts(lab, guidance);
  const fold = (s) => (s ? { count: countItems(s.body), html: renderMarkdown(s.body) } : null);
  return {
    moduleHref: "/map/m1", moduleLabel: "Module 1", label: "1.1", title: "Find your way",
    guidanceLabel: { guided: "Guided", half: "Half guided", independent: "Independent" }[guidance],
    introHtml: renderMarkdown(p.intro), task: p.task.map((s) => ({ heading: s.heading, html: renderMarkdown(s.body) })),
    steps: fold(p.steps), hints: fold(p.hints),
    debuggingHtml: renderMarkdown(read("debugging-lab.md")), ownBuildHtml: renderMarkdown(read("own-build.md")),
  };
};

await withPhone(async (page) => {
  for (const [guidance, steps, hints] of [["guided", true, true], ["half", false, true], ["independent", false, false]]) {
    const html = await renderView("components/views/project-view.tsx", "ProjectView", props(guidance));
    const command = await renderView("components/copy-command.tsx", "CopyCommand", { command: "npx academy check m1-p1" });
    await page.setContent(html.replace("</main>", `${command.slice(command.indexOf("<main"), command.lastIndexOf("</main>")).replace(/^<main[^>]*>/, "")}</main>`));
    assert.equal(await page.getByText(/^Steps \(\d+\)$/).count() === 1, steps, `${guidance}: Steps ${steps ? "shown" : "hidden"}`); checks++;
    assert.equal(await page.getByText(/^Hints \(\d+\)$/).count() === 1, hints, `${guidance}: Hints ${hints ? "shown" : "hidden"}`); checks++;
    assert.ok(await noSideways(page), `${guidance}: no sideways scroll`); checks++;
  }
  assert.ok(await page.getByText("No result yet. Run the command in your terminal.").isVisible()); checks++;
  const copy = page.getByRole("button", { name: "Copy: npx academy check m1-p1" });
  assert.ok(await copy.isVisible(), "the Copy button is a real button"); checks++;
  assert.ok((await copy.boundingBox()).height >= 44, "Copy is at least 44px"); checks++;
  await page.keyboard.press("Tab");
  for (let i = 0; i < 20 && !(await copy.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
  assert.ok(await copy.evaluate((el) => el === document.activeElement), "Copy can be reached by keyboard"); checks++;
});
console.log(`Project task (360px): ${checks} checks passed.`);
