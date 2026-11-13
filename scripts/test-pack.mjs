/**
 * T17: the packed checker. Lists the tarball (no lesson, quiz or answer inside); installs it
 * in an empty folder without the network; runs doctor, init and check from that install.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: "utf8", ...opts });
let n = 0;
const ok = (v, label) => { assert.ok(v, label); n++; };

const packed = run(process.execPath, [join(repo, "scripts", "pack-checker.mjs")]);
assert.equal(packed.status, 0, packed.stderr);
const tgz = packed.stdout.trim().split("\n").at(-1);
const files = run("tar", ["-tzf", tgz]).stdout.split("\n").filter(Boolean);
ok(files.includes("package/dist/academy.mjs") && files.includes("package/bin/academy.mjs"), "the bundle and the bin are packed");
ok(files.includes("package/checks/module-01/unit-01/check/check.yaml"), "the check folders are packed");
for (const f of files) {
  assert.ok(!/(^|\/)(lesson|example|lab|debugging-lab|own-build|review|unit)\.md$|quiz\.json$|index\.json$/.test(f), `not in the package: ${f}`);
}
n++;
ok(files.every((f) => f.startsWith("package/checks/") || ["package/package.json", "package/README.md", "package/dist/academy.mjs", "package/bin/academy.mjs"].includes(f)), "nothing else is packed");
const manifest = JSON.parse(run("tar", ["-xzOf", tgz, "package/package.json"]).stdout);
ok(!manifest.dependencies, "no dependencies to install: everything is in the bundle");

// Install in an empty folder, offline, and run it from there.
const home = mkdtempSync(join(tmpdir(), "academy-pack-home-"));
const project = mkdtempSync(join(tmpdir(), "academy-pack-project-"));
try {
  writeFileSync(join(project, "package.json"), JSON.stringify({ name: "my-work", private: true }));
  const install = run("npm", ["install", "--offline", "--no-audit", "--no-fund", "--loglevel=error", tgz], { cwd: project });
  assert.equal(install.status, 0, install.stderr); n++;
  const env = { ...process.env, HOME: home, ACADEMY_CHECKS_DIR: "" };
  const academy = (...args) => run("npx", ["--no-install", "academy", ...args], { cwd: project, env });

  const doctor = academy("doctor");
  ok(doctor.status === 0 && doctor.stdout.includes("Ready."), `npx academy doctor works\n${doctor.stdout}${doctor.stderr}`);
  const init = academy("init", "m1-p1");
  ok(init.status === 0 && init.stdout.includes("Lab ready"), `npx academy init m1-p1 works\n${init.stdout}${init.stderr}`);
  const lab = join(home, "academy-labs", "m1-p1", "office");
  ok(JSON.parse(readFileSync(join(lab, ".vscode", "tasks.json"), "utf8")).tasks[0].command === "npx academy check m1-p1", "init writes the VS Code task");
  const check = academy("check", "m1-p1", "--dry-run");
  ok(check.status === 1 && check.stdout.includes("Result: NOT PASSED · dry run, nothing sent"), `npx academy check m1-p1 --dry-run works (fresh lab: not passed)\n${check.stdout}${check.stderr}`);
  ok(!existsSync(join(project, "node_modules", "@ruftech-academy", "checker", "checks", "module-01", "unit-01", "lesson.md")), "no lesson was installed");
} finally {
  rmSync(home, { recursive: true, force: true });
  rmSync(project, { recursive: true, force: true });
}
console.log(`Packed checker: ${n} checks passed.`);
