import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { loadCheck } from "../checks.ts";
import { CheckerError } from "../errors.ts";
import { labRoot } from "../lab.ts";
import { formatReport } from "../report.ts";
import { runSteps, type StepDefinition, type StepKinds } from "../runner.ts";

export type CheckOptions = { dryRun: boolean; dir?: string };

/**
 * Runs a check and prints the report. Exit 0 = passed, 1 = not passed.
 * Sending the signed result to the platform is added with the platform's route (T19/T20);
 * until then every run is a dry run.
 */
export async function check(id: string, options: CheckOptions, kinds: StepKinds, print: (line: string) => void): Promise<number> {
  const loaded = loadCheck(id);
  const workDir = options.dir ? resolve(options.dir) : loaded.def.lab?.root ? labRoot(loaded.def.lab.root) : process.cwd();
  if (!existsSync(workDir)) {
    if (loaded.def.lab?.root) throw new CheckerError(`The lab folder ${workDir} does not exist yet. Run: npx academy init ${id}`);
    throw new CheckerError(`The folder ${workDir} does not exist.`);
  }
  const { steps, passed } = await runSteps(loaded.def.steps as StepDefinition[], { workDir, checkDir: loaded.dir }, kinds, loaded.def.messages ?? {});
  const sent = options.dryRun ? "dry run, nothing sent" : "not sent yet (sending arrives with a later update)";
  print(formatReport(loaded, steps, passed, sent));
  return passed ? 0 : 1;
}
