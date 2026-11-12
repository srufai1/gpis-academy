/**
 * Renders a page view component with offline data into a full HTML page,
 * styled with the CSS of the last `npm run build`, for the 360px browser tests.
 * The views are pure (no database, no sign-in), so no server is needed.
 * The view is bundled with esbuild; next/link becomes a plain <a>.
 *
 *   const html = await renderView("components/views/map-view.tsx", "MapView", props);
 *   await page.setContent(html);
 */
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const web = fileURLToPath(new URL("../../apps/web/", import.meta.url));
const linkStub = fileURLToPath(new URL("./next-link-stub.mjs", import.meta.url));

function builtCss() {
  const dir = join(web, ".next", "static", "chunks");
  if (!existsSync(dir)) throw new Error("Run `npm run build` first: the browser tests use its CSS.");
  return readdirSync(dir, { recursive: true }).map(String).filter((f) => f.endsWith(".css"))
    .map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
}

export async function renderView(relativePath, exportName, props) {
  // Inside the repository so the bundle finds react in node_modules.
  const cacheDir = join(web, "node_modules", ".cache");
  mkdirSync(cacheDir, { recursive: true });
  const out = mkdtempSync(join(cacheDir, "academy-view-"));
  try {
    const file = join(out, "view.mjs");
    await build({
      entryPoints: [join(web, "src", relativePath)],
      outfile: file,
      bundle: true,
      platform: "node",
      format: "esm",
      jsx: "automatic",
      tsconfig: join(web, "tsconfig.json"),
      alias: { "next/link": linkStub },
      external: ["react", "react-dom", "react/jsx-runtime"],
      nodePaths: [join(web, "node_modules"), fileURLToPath(new URL("../../node_modules/", import.meta.url))],
      logLevel: "silent",
    });
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const mod = await import(pathToFileURL(file).href);
    const body = renderToStaticMarkup(createElement(mod[exportName], props));
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${builtCss()}</style></head><body><main class="px-4 pt-6 pb-24">${body}</main></body></html>`;
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}
