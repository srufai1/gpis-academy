/**
 * Runs one command with a time limit and an output limit (T15). The command comes from
 * the check file (trusted, reviewed in the repo), never from the learner. On a timeout or
 * too much output the whole process group is stopped.
 */
import { spawn } from "node:child_process";

export type RunResult = { code: number | null; stdout: string; stderr: string; timedOut: boolean; tooMuchOutput: boolean; missing: boolean };

export const DEFAULT_TIMEOUT_SECONDS = 60;
export const MAX_TIMEOUT_SECONDS = 600;
export const MAX_OUTPUT_BYTES = 1024 * 1024;

export function runCommand(command: string, args: string[], options: { cwd: string; timeoutSeconds?: number; maxOutputBytes?: number; env?: Record<string, string> }): Promise<RunResult> {
  const timeoutMs = Math.min(Math.max(options.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS, 1), MAX_TIMEOUT_SECONDS) * 1000;
  const maxBytes = options.maxOutputBytes ?? MAX_OUTPUT_BYTES;
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: options.cwd, detached: true, env: { ...process.env, CI: "1", FORCE_COLOR: "0", ...options.env }, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "", bytes = 0, timedOut = false, tooMuchOutput = false, done = false;
    const stop = () => { try { process.kill(-child.pid!, "SIGKILL"); } catch { /* already gone */ } };
    const timer = setTimeout(() => { timedOut = true; stop(); }, timeoutMs);
    const take = (chunk: Buffer, into: "out" | "err") => {
      bytes += chunk.length;
      if (bytes > maxBytes) { if (!tooMuchOutput) { tooMuchOutput = true; stop(); } return; }
      if (into === "out") stdout += chunk.toString("utf8"); else stderr += chunk.toString("utf8");
    };
    child.stdout.on("data", (c: Buffer) => take(c, "out"));
    child.stderr.on("data", (c: Buffer) => take(c, "err"));
    const finish = (code: number | null, missing = false) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut, tooMuchOutput, missing });
    };
    child.on("error", (error: NodeJS.ErrnoException) => finish(null, error.code === "ENOENT"));
    child.on("close", (code) => finish(code));
  });
}

/** The last few non-empty lines of some output, for a failure reason. */
export function tail(text: string, lines = 3): string[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(-lines);
}
