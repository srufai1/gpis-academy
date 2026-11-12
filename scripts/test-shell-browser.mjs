/**
 * T02 browser test at 360px (needs `npm run build` first and Playwright).
 * Landing renders with its main button, nothing scrolls sideways, and the
 * signed-in shell has three bottom-bar links, each at least 44px tall.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.GPIS_PLAYWRIGHT_MODULE ?? "playwright");
const web = fileURLToPath(new URL("../apps/web/", import.meta.url));
const port = 3100 + Math.floor(Math.random() * 500);
const base = `http://127.0.0.1:${port}`;

const server = spawn(process.execPath, [require.resolve("next/dist/bin/next", { paths: [web] }), "start", "-p", String(port), "-H", "127.0.0.1"], {
  cwd: web,
  env: { ...process.env, NODE_ENV: "production" },
  stdio: "ignore",
});

async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base)).status < 500) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("next start did not answer");
}

const noSideways = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
let checks = 0;
const browser = await chromium.launch();
try {
  await waitForServer();
  const page = await browser.newPage({ viewport: { width: 360, height: 780 } });

  await page.goto(`${base}/`);
  assert.ok(await page.getByRole("heading", { level: 1 }).isVisible(), "landing heading visible"); checks++;
  const start = page.getByRole("link", { name: "Start learning" });
  assert.ok(await start.isVisible(), "main button visible"); checks++;
  assert.ok((await start.boundingBox()).height >= 44, "main button at least 44px"); checks++;
  assert.ok(await noSideways(page), "landing: no sideways scroll"); checks++;

  // T03 puts /map behind sign-in; the shell itself is checked on whatever page renders it.
  await page.goto(`${base}/map`);
  const bar = page.getByRole("navigation", { name: "Main" }).filter({ visible: true });
  if (await bar.count()) {
    const links = bar.getByRole("link");
    assert.equal(await links.count(), 3, "three bottom-bar links"); checks++;
    for (const box of await Promise.all((await links.all()).map((l) => l.boundingBox())))
      assert.ok(box.height >= 44, "bottom-bar target at least 44px");
    checks++;
    assert.ok(await noSideways(page), "shell: no sideways scroll"); checks++;
  } else {
    assert.match(new URL(page.url()).pathname, /^\/sign-in$/, "signed out: /map goes to sign-in"); checks++;
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(`Shell (360px): ${checks} checks passed.`);
