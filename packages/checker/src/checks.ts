/**
 * Finding and loading checks. A check is a folder with check.yaml (docs/checker.md).
 * Where checks come from, first match wins:
 *   1. ACADEMY_CHECKS_DIR (for course authors and tests)
 *   2. the checks/ folder shipped inside the installed package (T17)
 *   3. content/ in this repository (development)
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { validateCheck } from "@ruftech-academy/shared/content-schema";
import { folderHash } from "@ruftech-academy/shared/content-load";
import { CheckerError } from "./errors.ts";

export type LoadedCheck = {
  id: string;
  title: string;
  version: string;
  sha256: string;
  dir: string;
  /** The parsed check.yaml, validated for its common fields. */
  def: Record<string, unknown> & { steps: Record<string, unknown>[]; lab?: { root?: string; seed?: string }; messages?: Record<string, string>; requires?: string[] };
};

export function checksRoots(): string[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const roots = [process.env.ACADEMY_CHECKS_DIR, join(here, "..", "checks"), join(here, "..", "..", "..", "content")];
  return roots.filter((r): r is string => !!r && existsSync(r));
}

function findCheckFiles(dir: string, out: string[] = [], depth = 0): string[] {
  if (depth > 4) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = join(dir, name);
    if (!statSync(full).isDirectory()) continue;
    if (name === "check" && existsSync(join(full, "check.yaml"))) out.push(full);
    else findCheckFiles(full, out, depth + 1);
  }
  return out;
}

export function loadCheck(id: string): LoadedCheck {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) throw new CheckerError(`"${id}" is not a check id. It looks like m1-p1.`);
  for (const root of checksRoots()) {
    for (const dir of findCheckFiles(root)) {
      let def: unknown;
      try { def = parseYaml(readFileSync(join(dir, "check.yaml"), "utf8")); } catch { continue; }
      if (typeof def !== "object" || def === null || (def as { id?: unknown }).id !== id) continue;
      const problems = validateCheck(def);
      if (problems.length) throw new CheckerError(`The check ${id} is not valid: ${problems.join("; ")}`);
      const d = def as LoadedCheck["def"] & { title: string; version: string };
      return { id, title: d.title, version: d.version, sha256: folderHash(dir), dir, def: d };
    }
  }
  throw new CheckerError(`There is no check called ${id}. Update the checker if the course added it recently.`);
}
