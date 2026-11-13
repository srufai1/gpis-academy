import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

export type DoctorLine = { name: string; ok: boolean; detail: string; required: boolean };

const run = (cmd: string, args: string[]) => spawnSync(cmd, args, { encoding: "utf8", timeout: 5000 });

/** What this computer needs for the course: Linux (WSL 2 on Windows), Node 22.18+, Git, bash. */
export function doctorLines(): DoctorLine[] {
  const lines: DoctorLine[] = [];
  const proc = existsSync("/proc/version") ? readFileSync("/proc/version", "utf8") : "";
  const wsl = /microsoft/i.test(proc);
  lines.push({ name: "system", ok: process.platform === "linux", required: true,
    detail: process.platform === "linux" ? (wsl ? "WSL 2 (Ubuntu)" : "Linux") : `${process.platform}: open the VS Code terminal inside WSL 2 (Ubuntu)` });
  const [major = 0, minor = 0] = process.versions.node.split(".").map(Number);
  const nodeOk = major > 22 || (major === 22 && minor >= 18);
  lines.push({ name: "node", ok: nodeOk, required: true, detail: nodeOk ? `v${process.versions.node}` : `v${process.versions.node}: install Node 22.18 or later` });
  const git = run("git", ["--version"]);
  lines.push({ name: "git", ok: git.status === 0, required: true, detail: git.status === 0 ? git.stdout.trim() : "not found: sudo apt install git" });
  const bash = run("bash", ["--version"]);
  lines.push({ name: "bash", ok: bash.status === 0, required: true, detail: bash.status === 0 ? (bash.stdout.split("\n")[0] ?? "bash") : "not found" });
  return lines;
}

export function doctor(print: (line: string) => void): number {
  const lines = doctorLines();
  for (const l of lines) print(`  ${l.ok ? "OK  " : "MISSING"} ${l.name.padEnd(7)} ${l.detail}`);
  const ready = lines.every((l) => l.ok || !l.required);
  print(ready ? "Ready." : "Not ready yet: fix the MISSING lines above, then run npx academy doctor again.");
  return ready ? 0 : 1;
}
