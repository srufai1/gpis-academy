/** T08: lesson Markdown renders safely. Raw HTML is shown as text, never run. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderMarkdown } from "../apps/web/src/lib/content/markdown.ts";

let checks = 0;
const html = (src) => renderMarkdown(src);

assert.ok(!html("<script>alert(1)</script>").includes("<script"), "a script tag is escaped"); checks++;
assert.ok(html("<script>alert(1)</script>").includes("&lt;script&gt;"), "and shown as text"); checks++;
assert.ok(!/<img[^>]*onerror/i.test(html('<img src=x onerror="alert(1)">')), "an inline event handler never becomes HTML"); checks++;
assert.ok(!html("[x](javascript:alert(1))").includes('href="javascript:'), "javascript: links are refused"); checks++;
assert.ok(!html("[x](data:text/html,hi)").includes('href="data:'), "data: links are refused"); checks++;
assert.ok(html("[GPIS](https://example.com)").includes('rel="noopener noreferrer"'), "outside links open safely"); checks++;
assert.match(html("## Title"), /<h3>Title<\/h3>/, "headings move one level down"); checks++;
assert.ok(!html("# Top").includes("<h1"), "a lesson never adds a second h1"); checks++;
assert.match(html("| a | b |\n| - | - |\n| 1 | 2 |"), /<div class="md-scroll"><table>/, "tables scroll inside themselves"); checks++;
assert.match(html("```bash\nls -l\n```"), /<div class="md-code"><pre><code class="language-bash">ls -l/, "code blocks are wrapped to scroll"); checks++;
assert.match(html("- one\n- two"), /<ul>\n<li>one<\/li>/); checks++;

// The real lesson renders with no raw HTML tags from the source.
const lesson = readFileSync(new URL("../content/module-01/unit-01/lesson.md", import.meta.url), "utf8");
const out = html(lesson);
assert.ok(out.includes("<h3>") && out.includes("<table>") && out.includes("<pre>"), "the sample lesson has headings, a table and code"); checks++;

console.log(`Markdown: ${checks} checks passed.`);
