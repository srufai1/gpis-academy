import type { StepKinds } from "../runner.ts";
import { docStep } from "./doc.ts";
import { filesStep } from "./files.ts";
import { gitStep } from "./git.ts";

/** Every step kind this checker knows. T15 adds tests and static; T16 adds sql and page. */
export const STEP_KINDS: StepKinds = {
  files: filesStep,
  doc: docStep,
  git: gitStep,
};
