import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pnpmEntry = process.env.npm_execpath && path.basename(process.env.npm_execpath).toLowerCase().includes("pnpm")
  ? process.env.npm_execpath
  : null;

function pnpmCheck(name, args) {
  if (pnpmEntry) return { name, command: process.execPath, args: [pnpmEntry, ...args] };
  if (process.platform === "win32") {
    throw new Error("On Windows, run this verifier through `pnpm verify:project` so the pnpm JS entry point is available.");
  }
  return { name, command: "pnpm", args };
}

const checks = [
  {
    name: "Autonomy interruption and recovery tests",
    command: process.execPath,
    args: ["--test", "tests/autonomy-runtime.test.mjs"],
  },
  pnpmCheck("Schema validation", ["validate:schemas"]),
  pnpmCheck("Shared types tests", ["test:shared-types"]),
  pnpmCheck("API client tests", ["test:api-client"]),
  pnpmCheck("Web build", ["--dir", "apps/web", "build"]),
  {
    name: "Desktop controlled-workspace tests",
    command: "cargo",
    args: ["test", "--manifest-path", "apps/desktop/src-tauri/Cargo.toml"],
  },
  pnpmCheck("Desktop security check", ["--dir", "apps/desktop", "check:security"]),
  pnpmCheck("Desktop build", ["--dir", "apps/desktop", "build"]),
  {
    name: "MCAgent Server tests",
    command: "python",
    args: ["-m", "pytest", "-q"],
    cwd: path.join(repositoryRoot, "services", "mcagent-server"),
  },
  pnpmCheck("Autonomy boundary check", ["check:autonomy-boundaries"]),
  { name: "Git whitespace check", command: "git", args: ["diff", "--check"] },
];

for (const check of checks) {
  console.log(`\n==> ${check.name}`);
  const result = spawnSync(check.command, check.args, {
    cwd: check.cwd ?? repositoryRoot,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`${check.name} could not start: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`${check.name} failed with exit code ${result.status ?? "unknown"}.`);
    process.exit(result.status ?? 1);
  }
}

console.log("\nProject verification passed: all configured checks completed successfully.");
