import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { loadCheck } from "../checks.ts";
import { CheckerError } from "../errors.ts";
import { labRoot } from "../lab.ts";
import { insideRoot } from "../safe-path.ts";

/** Builds the lab folder from the check's seed. Refuses to overwrite unless --reset. */
export function init(id: string, reset: boolean, print: (line: string) => void): number {
  const check = loadCheck(id);
  const lab = check.def.lab;
  if (!lab?.root || !lab.seed) throw new CheckerError(`${id} has no lab to set up. Work in your own project folder.`);
  const root = labRoot(lab.root);
  if (existsSync(root) && readdirSync(root).length > 0 && !reset) {
    print(`${root} already exists. Your work there is kept.`);
    print(`To start again from scratch (this deletes it): npx academy init ${id} --reset`);
    return 1;
  }
  const seed = insideRoot(check.dir, lab.seed);
  const run = spawnSync("bash", [seed, root], { encoding: "utf8", timeout: 30000 });
  if (run.status !== 0) throw new CheckerError(`Setting up the lab failed: ${(run.stderr || run.stdout).trim().slice(0, 300)}`);
  print(`Lab ready: ${root}`);
  print(`Next: cd ${root}`);
  return 0;
}
