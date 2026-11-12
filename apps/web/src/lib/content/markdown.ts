import MarkdownIt from "markdown-it";

/**
 * Lesson Markdown to safe HTML (T08). Raw HTML in a lesson is escaped and shown
 * as text, never run (html: false). Links with javascript:, vbscript: or data:
 * are refused by markdown-it. Tables and code blocks scroll inside themselves.
 * Headings move one level down: the page title is the page's only <h1>.
 */
const md = new MarkdownIt({ html: false, linkify: false, typographer: false });

const shift = (tag: string) => `h${Math.min(Number(tag.slice(1)) + 1, 6)}`;
md.renderer.rules.heading_open = (tokens, idx) => `<${shift(tokens[idx]!.tag)}>`;
md.renderer.rules.heading_close = (tokens, idx) => `</${shift(tokens[idx]!.tag)}>`;

md.renderer.rules.table_open = () => '<div class="md-scroll"><table>';
md.renderer.rules.table_close = () => "</table></div>";

const defaultFence = md.renderer.rules.fence!;
md.renderer.rules.fence = (tokens, idx, options, env, self) =>
  `<div class="md-code">${defaultFence(tokens, idx, options, env, self)}</div>`;

const defaultLink = md.renderer.rules.link_open ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const href = tokens[idx]!.attrGet("href") ?? "";
  if (/^https?:\/\//i.test(href)) {
    tokens[idx]!.attrSet("target", "_blank");
    tokens[idx]!.attrSet("rel", "noopener noreferrer");
  }
  return defaultLink(tokens, idx, options, env, self);
};

export function renderMarkdown(source: string): string {
  return md.render(source);
}
