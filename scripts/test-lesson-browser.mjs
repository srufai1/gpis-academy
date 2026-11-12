/** T08 at 360px: the sample lesson renders; code blocks scroll inside themselves; nothing scrolls sideways. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderView } from "./lib/render-view.mjs";
import { noSideways, withPhone } from "./lib/browser.mjs";
import { renderMarkdown } from "../apps/web/src/lib/content/markdown.ts";

const read = (f) => readFileSync(new URL(`../content/module-01/unit-01/${f}`, import.meta.url), "utf8");
const wide = "```bash\n" + "x".repeat(300) + "\n```\n\n<script>window.ran = true</script>\n";
let checks = 0;

await withPhone(async (page) => {
  await page.setContent(await renderView("components/views/lesson-view.tsx", "LessonView", {
    moduleHref: "/map/m1", moduleLabel: "Module 1", label: "1.1", title: "The terminal and the filesystem",
    lessonHtml: renderMarkdown(read("lesson.md") + "\n\n" + wide), exampleHtml: renderMarkdown(read("example.md")),
    gpisPart: "The folder layout of the GPIS repository", read: false,
  }));
  assert.equal(await page.getByRole("heading", { level: 1 }).count(), 1, "one h1: the page title"); checks++;
  assert.ok(await page.locator(".md pre").first().isVisible(), "code blocks render"); checks++;
  assert.ok(await noSideways(page), "no sideways scroll at 360px, even with a 300-character line"); checks++;
  const scrolls = await page.evaluate(() => [...document.querySelectorAll(".md-code")].some((el) => el.scrollWidth > el.clientWidth));
  assert.ok(scrolls, "the long code block scrolls inside itself"); checks++;
  assert.equal(await page.evaluate(() => window.ran === true), false, "a script in the lesson never runs"); checks++;
  assert.ok(await page.getByText("<script>window.ran = true</script>").isVisible(), "it is shown as text instead"); checks++;
  assert.equal(await page.getByText("In GPIS").count(), 1, "the GPIS pointer is there, folded"); checks++;
  assert.ok(!(await page.getByText("Open it after your own attempt").isVisible()), "folded until opened"); checks++;
  // Inline links inside lesson text are text-sized on purpose; the page's own controls are not.
  const controls = await page.evaluate(() => [...document.querySelectorAll("article > header a, details > summary")].map((el) => el.getBoundingClientRect().height));
  assert.ok(controls.every((h) => h >= 44), "the back link and the GPIS fold are at least 44px"); checks++;
});
console.log(`Lesson (360px): ${checks} checks passed.`);
