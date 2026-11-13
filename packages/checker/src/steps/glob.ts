import { lstatSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** Glob to a regular expression: ** any folders, * any name part, ? one character. Dot files match. */
export function globToRegExp(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === "*" && glob[i + 1] === "*") { re += glob[i + 2] === "/" ? "(?:.*/)?" : ".*"; i += glob[i + 2] === "/" ? 2 : 1; }
    else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

/** Every path under root (relative, "/" separated) that matches the glob. Links are not followed. */
export function globFiles(root: string, glob: string, limit = 5000): string[] {
  const re = globToRegExp(glob);
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (found.length >= limit) return;
      const full = join(dir, name);
      const rel = relative(root, full).split(sep).join("/");
      if (re.test(rel)) found.push(rel);
      const st = lstatSync(full);
      if (st.isDirectory() && name !== "node_modules" && name !== ".git") walk(full);
    }
  };
  walk(root);
  return found;
}
