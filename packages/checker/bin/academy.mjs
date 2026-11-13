#!/usr/bin/env node
// Entry point of the installed checker: the bundled build (T17), or the TypeScript source in the repo.
import { existsSync } from "node:fs";
const built = new URL("../dist/academy.mjs", import.meta.url);
const { main } = await import(existsSync(built) ? built.href : new URL("../src/cli.ts", import.meta.url).href);
process.exitCode = await main(process.argv.slice(2));
