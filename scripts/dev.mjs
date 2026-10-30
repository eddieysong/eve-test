import "./build-web.mjs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const child = spawn(process.execPath, ["node_modules/eve/bin/eve.js", "dev", "--no-default-extensions", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, COMPANION_DATA_DIR: process.env.COMPANION_DATA_DIR || resolve(".companion") },
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", code => process.exit(code ?? 1));
