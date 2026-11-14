/**
 * The quality gates of a screen (T23), measured in the browser on the rendered page:
 * no sideways scroll at 360px, targets at least 44px, at most one main button, the keyboard
 * reaches every control, and text contrast meets WCAG AA. Returns the problems found.
 */
import { noSideways } from "./browser.mjs";

/** Controls under 44px tall. Links inside lesson prose (.md) are text-sized on purpose (WCAG 2.5.8 inline exception). */
const smallTargets = (page) => page.evaluate(() => [...document.querySelectorAll("a, button, summary, label:has(input[type=checkbox])")]
  .filter((el) => el.getClientRects().length && getComputedStyle(el).visibility !== "hidden" && !el.closest(".md"))
  .filter((el) => el.getBoundingClientRect().height < 44)
  .map((el) => (el.textContent || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 30)));

/** Text vs. background contrast for every visible text, in real drawn colours (any CSS colour space). */
export function lowContrast(page) {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const rgba = (color) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "rgba(0,0,0,0)";
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], d[3] / 255];
    };
    const over = (top, bottom) => [0, 1, 2].map((i) => top[i] * top[3] + bottom[i] * (1 - top[3])).concat(1);
    const lum = ([r, g, b]) => {
      const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const background = (el) => {
      const chain = [];
      for (let e = el; e; e = e.parentElement) chain.unshift(e);
      let bg = [255, 255, 255, 1];
      for (const e of chain) {
        const c = rgba(getComputedStyle(e).backgroundColor);
        if (c[3] > 0) bg = over(c, bg);
      }
      return bg;
    };
    const hidden = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width < 2 || r.height < 2 || s.visibility === "hidden" || s.clip === "rect(0px, 0px, 0px, 0px)" || s.clipPath === "inset(50%)";
    };
    const problems = [];
    for (const el of document.body.querySelectorAll("*")) {
      const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ").trim();
      if (!text || hidden(el) || el.closest("[disabled], [aria-disabled='true']")) continue;
      const s = getComputedStyle(el);
      const bg = background(el);
      const fg = over(rgba(s.color), bg);
      const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
      const ratio = (hi + 0.05) / (lo + 0.05);
      const size = parseFloat(s.fontSize);
      const large = size >= 24 || (size >= 18.66 && Number(s.fontWeight) >= 700);
      if (ratio < (large ? 3 : 4.5)) problems.push(`${text.slice(0, 30)} (${ratio.toFixed(2)}:1)`);
    }
    return problems;
  });
}

/** Controls the Tab key never reaches. */
export async function unreachable(page) {
  const want = await page.evaluate(() => {
    const visible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden" && !el.closest("details:not([open]) > :not(summary)");
    const all = [...document.querySelectorAll("a[href], button, summary, input, textarea, select")].filter((el) => visible(el) && !el.disabled);
    all.forEach((el, i) => el.setAttribute("data-q", String(i)));
    return all.length;
  });
  const reached = new Set();
  await page.evaluate(() => document.activeElement?.blur());
  for (let i = 0; i < want + 20; i++) {
    await page.keyboard.press("Tab");
    const id = await page.evaluate(() => document.activeElement?.getAttribute("data-q"));
    if (id !== null && id !== undefined) reached.add(id);
  }
  return page.evaluate((got) => [...document.querySelectorAll("[data-q]")].filter((el) => !got.includes(el.getAttribute("data-q")))
    .map((el) => (el.textContent || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 30)), [...reached]);
}

/** Visible main (filled, primary) buttons. */
export const mainButtons = (page) => page.evaluate(() =>
  [...document.querySelectorAll("a, button")].filter((el) => el.getClientRects().length && el.className.split(/\s+/).includes("bg-primary"))
    .map((el) => el.textContent.trim().slice(0, 30)));

/** Every gate, for one screen in one state. `main` is how many main buttons the mockup has there (0 or 1). */
export async function audit(page, label, { main }) {
  const problems = [];
  if (!(await noSideways(page))) problems.push("scrolls sideways at 360px");
  const small = await smallTargets(page);
  if (small.length) problems.push(`targets under 44px: ${small.join(", ")}`);
  const buttons = await mainButtons(page);
  if (buttons.length !== main) problems.push(`${buttons.length} main buttons (${buttons.join(", ")}), expected ${main}`);
  const missed = await unreachable(page);
  if (missed.length) problems.push(`not reached by Tab: ${missed.join(", ")}`);
  const low = await lowContrast(page);
  if (low.length) problems.push(`contrast below AA: ${low.slice(0, 6).join("; ")}${low.length > 6 ? ` … (${low.length})` : ""}`);
  return problems.map((p) => `${label}: ${p}`);
}
