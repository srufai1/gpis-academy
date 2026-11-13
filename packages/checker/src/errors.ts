/** A problem with the checker or the check itself (exit code 2), not with the learner's work. */
export class CheckerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckerError";
  }
}
