import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { CheckerError } from "./errors.ts";
import { isInside } from "./safe-path.ts";

/** A lab root from check.yaml ("~/academy-labs/m1-p1/office"), always inside ~/academy-labs. */
export function labRoot(root: string): string {
  const expanded = root.startsWith("~/") ? join(homedir(), root.slice(2)) : root;
  if (!isAbsolute(expanded)) throw new CheckerError(`The lab root "${root}" must start with ~/.`);
  const labs = join(homedir(), "academy-labs");
  if (!isInside(labs, resolve(expanded)) || resolve(expanded) === labs) throw new CheckerError(`The lab root "${root}" must be inside ~/academy-labs.`);
  return resolve(expanded);
}
