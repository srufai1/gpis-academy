/** Shared helpers for the 360px browser tests (Playwright, offline views). */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.GPIS_PLAYWRIGHT_MODULE ?? "playwright");

export async function withPhone(run) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 360, height: 780 } });
    await run(page);
  } finally {
    await browser.close();
  }
}

export const noSideways = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/** Every visible link and button is at least 44px tall. */
export async function smallTargets(page) {
  return page.evaluate(() => [...document.querySelectorAll("a, button, summary")]
    .filter((el) => el.getClientRects().length && getComputedStyle(el).visibility !== "hidden")
    .filter((el) => el.getBoundingClientRect().height < 44)
    .map((el) => (el.textContent || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 40)));
}
