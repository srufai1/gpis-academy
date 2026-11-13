/**
 * Step kind "page" (T16): opens a page on this computer at 360px and reports what a user sees.
 *   url:    "http://localhost:3000/…"   (localhost or 127.0.0.1 only; the checker starts nothing)
 *   expect: { status, title_contains, text: [...], no_sideways_scroll, min_target_px }
 * Needs Playwright with Chromium; without it, or with no page running, the result is "needs".
 */
import { createRequire } from "node:module";
import { join } from "node:path";
import { CheckerError } from "../errors.ts";
import type { StepKindImpl } from "../runner.ts";

type Expect = { status?: number; title_contains?: string; text?: string[]; no_sideways_scroll?: boolean; min_target_px?: number };
type Browser = { newPage(o: object): Promise<Page>; close(): Promise<void> };
type Page = {
  goto(url: string, o: object): Promise<{ status(): number } | null>;
  title(): Promise<string>;
  evaluate<T>(fn: (arg: number) => T, arg: number): Promise<T>;
  getByText(t: string): { first(): { isVisible(): Promise<boolean> } };
};

async function loadChromium(projectDir: string): Promise<{ launch(): Promise<Browser> } | null> {
  for (const from of [join(projectDir, "package.json"), import.meta.url]) {
    try {
      const req = createRequire(from);
      return req(process.env.GPIS_PLAYWRIGHT_MODULE ?? "playwright").chromium;
    } catch { /* try the next place */ }
  }
  return null;
}

export const pageStep: StepKindImpl = async (step, ctx) => {
  const url = step.url;
  if (typeof url !== "string") throw new CheckerError("a page step needs url");
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new CheckerError(`"${url}" is not a web address`); }
  if (parsed.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(parsed.hostname)) throw new CheckerError("a page step only opens http://localhost or http://127.0.0.1");
  const e = (step.expect ?? {}) as Expect;

  const chromium = await loadChromium(ctx.workDir);
  if (!chromium) return { outcome: "needs", reasons: ["Playwright is not installed: npm install -D playwright && npx playwright install chromium"] };
  let browser: Browser;
  try { browser = await chromium.launch(); } catch {
    return { outcome: "needs", reasons: ["The browser for Playwright is missing: npx playwright install chromium"] };
  }
  try {
    const page = await browser.newPage({ viewport: { width: 360, height: 780 } });
    let response;
    try { response = await page.goto(url, { waitUntil: "load", timeout: 20000 }); } catch {
      return { outcome: "needs", reasons: [`Nothing answered at ${url}. Start your app first (npm run dev).`] };
    }
    const reasons: string[] = [];
    const status = response?.status() ?? 0;
    if (status !== (e.status ?? 200)) reasons.push(`${url} answered ${status}, expected ${e.status ?? 200}`);
    if (e.title_contains && !(await page.title()).includes(e.title_contains)) reasons.push(`the page title does not contain "${e.title_contains}"`);
    for (const t of e.text ?? []) if (!(await page.getByText(t).first().isVisible().catch(() => false))) reasons.push(`"${t}" is not visible on the page`);
    if (e.no_sideways_scroll !== false && await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth, 0)) reasons.push("the page scrolls sideways at 360px");
    if (e.min_target_px) {
      const small = await page.evaluate((min) => [...document.querySelectorAll("a, button, input, select, summary")]
        .filter((el) => el.getClientRects().length && el.getBoundingClientRect().height < min)
        .map((el) => (el.textContent || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 30)), e.min_target_px);
      if (small.length) reasons.push(`tap targets under ${e.min_target_px}px: ${small.slice(0, 3).join(", ")}`);
    }
    return { outcome: reasons.length ? "fail" : "pass", reasons };
  } finally {
    await browser.close();
  }
};
