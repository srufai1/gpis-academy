import { realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { CheckerError } from "./errors.ts";

/** True when `child` is `root` or inside it. Both must be absolute. */
export function isInside(root: string, child: string): boolean {
  const rel = relative(root, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel) && !rel.split(sep).includes(".."));
}

/**
 * Resolves a path named by a check inside a root folder (the project, the lab, or the
 * check's own folder). A path that leaves the root, by "..", by an absolute path, or
 * through a link that points outside, is refused.
 */
export function insideRoot(root: string, path: string, { followLinks = false }: { followLinks?: boolean } = {}): string {
  if (typeof path !== "string" || path.length === 0 || path.includes("\0")) throw new CheckerError(`Path "${String(path)}" is not valid.`);
  if (isAbsolute(path)) throw new CheckerError(`Path "${path}" must be relative to the project.`);
  const full = resolve(root, path);
  if (!isInside(resolve(root), full)) throw new CheckerError(`Path "${path}" leaves the project folder.`);
  if (followLinks) {
    let real: string;
    try { real = realpathSync(full); } catch { return full; }
    if (!isInside(realpathSync(root), real)) throw new CheckerError(`Path "${path}" points outside the project folder.`);
  }
  return full;
}
