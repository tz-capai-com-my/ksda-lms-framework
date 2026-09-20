import { spawn } from "node:child_process";
// Cross-platform bounded build; preserves the caller's HOME and credentials.
const child = spawn(process.execPath, ["node_modules/vinext/dist/cli.js", "build"], { stdio: "inherit" });
const timeout = setTimeout(() => { child.kill("SIGTERM"); setTimeout(() => child.kill("SIGKILL"), 10000).unref(); }, 180000);
child.on("error", error => { clearTimeout(timeout); console.error(error.message); process.exitCode = 1; });
child.on("exit", code => { clearTimeout(timeout); process.exitCode = code ?? 1; });
