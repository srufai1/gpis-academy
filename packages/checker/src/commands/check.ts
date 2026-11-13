import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { loadCheck } from "../checks.ts";
import { CheckerError } from "../errors.ts";
import { labRoot } from "../lab.ts";
import { formatReport } from "../report.ts";
import { runSteps, type StepDefinition, type StepKinds } from "../runner.ts";
import { commitOf, prepareSend, sendResult, type Prepared, type SendDeps } from "../send.ts";

export type CheckOptions = { dryRun: boolean; dir?: string; fetch?: SendDeps["fetch"]; now?: () => number };

/**
 * Runs a check, prints the report and (unless --dry-run) sends the signed result (T20).
 * Exit 0 = passed, 1 = not passed — whether or not the result reached the platform:
 * the exit code is about the work, the last line says whether it was recorded.
 */
export async function check(id: string, options: CheckOptions, kinds: StepKinds, print: (line: string) => void): Promise<number> {
  const deps: SendDeps = { fetch: options.fetch ?? fetch, now: options.now ?? Date.now };
  const loaded = loadCheck(id);
  const workDir = options.dir ? resolve(options.dir) : loaded.def.lab?.root ? labRoot(loaded.def.lab.root) : process.cwd();
  if (!existsSync(workDir)) {
    if (loaded.def.lab?.root) throw new CheckerError(`The lab folder ${workDir} does not exist yet. Run: npx academy init ${id}`);
    throw new CheckerError(`The folder ${workDir} does not exist.`);
  }
  const ref = { id: loaded.id, version: loaded.version, sha256: loaded.sha256 };
  // The challenge comes first: the platform must see a fresh nonce before the steps run.
  const prepared: Prepared | null = options.dryRun ? null : await prepareSend(ref, deps);

  const seconds = () => Math.floor(deps.now() / 1000);
  const startedAt = seconds();
  const { steps, passed } = await runSteps(loaded.def.steps as StepDefinition[], { workDir, checkDir: loaded.dir }, kinds, loaded.def.messages ?? {});
  const finishedAt = Math.max(seconds(), startedAt);

  let sent: string;
  if (!prepared) sent = "dry run, nothing sent";
  else if (!prepared.ok) sent = `not recorded: ${prepared.note}`;
  else sent = (await sendResult(prepared.ticket, { check: ref, steps, passed, startedAt, finishedAt, commit: commitOf(workDir) }, deps)).note;
  print(formatReport(loaded, steps, passed, sent));
  return passed ? 0 : 1;
}
