/**
 * academy — the GPIS Academy checker (docs/checker.md).
 * Exit codes: 0 passed / ready, 1 not passed / not ready, 2 checker error.
 */
import { CheckerError } from "./errors.ts";
import { check } from "./commands/check.ts";
import { doctor } from "./commands/doctor.ts";
import { init } from "./commands/init.ts";
import { STEP_KINDS } from "./steps/index.ts";
import { CHECKER_VERSION } from "./version.ts";

const HELP = `academy ${CHECKER_VERSION} — checks your GPIS Academy work on this computer

  npx academy doctor                 is this computer ready?
  npx academy init <id> [--reset]    set up a project's lab folder
  npx academy check <id> [--dry-run] check your work
  npx academy --version`;

export async function main(argv: string[], print: (line: string) => void = console.log, printError: (line: string) => void = console.error): Promise<number> {
  const [command, ...rest] = argv;
  const flags = new Set(rest.filter((a) => a.startsWith("--")));
  const args = rest.filter((a) => !a.startsWith("--"));
  const dirFlag = rest.find((a) => a.startsWith("--dir="))?.slice("--dir=".length);
  try {
    switch (command) {
      case "doctor": return doctor(print);
      case "init": return requireId(args[0]) && init(args[0]!, flags.has("--reset"), print);
      case "check": return requireId(args[0]) && (await check(args[0]!, { dryRun: flags.has("--dry-run"), ...(dirFlag ? { dir: dirFlag } : {}) }, STEP_KINDS, print));
      case "--version": case "-v": print(CHECKER_VERSION); return 0;
      case undefined: case "help": case "--help": case "-h": print(HELP); return 0;
      default: printError(`Unknown command "${command}".\n\n${HELP}`); return 2;
    }
  } catch (error) {
    if (error instanceof CheckerError) { printError(`Checker error: ${error.message}`); return 2; }
    printError(`Checker error: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
}

function requireId(id: string | undefined): true {
  if (!id) throw new CheckerError("Name the project, for example: npx academy check m1-p1");
  return true;
}
