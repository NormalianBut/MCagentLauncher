import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const capability = JSON.parse(await readFile(path.join(desktopRoot, "src-tauri", "capabilities", "default.json"), "utf8"));
const cargoToml = await readFile(path.join(desktopRoot, "src-tauri", "Cargo.toml"), "utf8");
const mainRs = await readFile(path.join(desktopRoot, "src-tauri", "src", "main.rs"), "utf8");
const controlledWorkspaceRs = await readFile(path.join(desktopRoot, "src-tauri", "src", "controlled_workspace.rs"), "utf8");
const mcagentClient = await readFile(path.join(desktopRoot, "src", "lib", "mcagentClient.ts"), "utf8");

if (JSON.stringify(capability.permissions) !== JSON.stringify(["core:default"])) {
  throw new Error("Desktop capability permissions must remain exactly [core:default].");
}

const forbidden = ["tauri-plugin-fs", "tauri-plugin-shell", "tauri-plugin-process", "tauri-plugin-updater", "tauri-plugin-autostart"];
for (const dependency of forbidden) {
  if (cargoToml.includes(dependency)) {
    throw new Error(`Forbidden Desktop runtime dependency found: ${dependency}`);
  }
}

if (/Command::|sidecar\s*\(/.test(mainRs + controlledWorkspaceRs)) {
  throw new Error("Desktop must not expose process or sidecar execution.");
}

const approvedCommands = [
  "executor_confirm_controlled_workspace",
  "executor_preview_controlled_workspace",
  "executor_recover",
  "executor_rollback",
  "executor_simulate_commit",
  "executor_simulate_interruption",
];
const exposedCommands = [...mainRs.matchAll(/#\[tauri::command\]\s*fn\s+([a-z0-9_]+)/g)]
  .map((match) => match[1])
  .sort();
if (JSON.stringify(exposedCommands) !== JSON.stringify(approvedCommands)) {
  throw new Error(`Desktop command allowlist mismatch: ${JSON.stringify(exposedCommands)}`);
}

const requiredWorkspaceControls = [
  "app.path().app_data_dir()",
  "canonicalize()",
  "symlink_metadata",
  "FILE_ATTRIBUTE_REPARSE_POINT",
  "create_new(true)",
  "sync_all()",
  "CONFIRMATION_REQUIRED",
  "OPERATION_MISMATCH",
  "ROLLBACK_OWNERSHIP_INVALID",
  "UNKNOWN_ARTIFACT",
  "simulationOperation",
];
for (const control of requiredWorkspaceControls) {
  if (!(mainRs + controlledWorkspaceRs).includes(control)) {
    throw new Error(`Required controlled-workspace security control is missing: ${control}`);
  }
}

const forbiddenExecutorPatterns = [
  /std::process::Command|Command::new|sidecar\s*\(/,
  /reqwest|hyper::Client|TcpStream|UdpSocket/,
  /join\s*\(\s*["']\.minecraft|java\.exe|javaw\.exe/i,
  /oauth|access[_-]?token|client[_-]?secret/i,
  /std::env::vars|std::env::var\s*\(/,
];
for (const pattern of forbiddenExecutorPatterns) {
  if (pattern.test(controlledWorkspaceRs)) {
    throw new Error(`Forbidden capability pattern found in controlled workspace module: ${pattern}`);
  }
}

if (/\b(?:path|root|directory)\s*:\s*String/.test(mainRs) || /PathBuf|&Path/.test(mainRs)) {
  throw new Error("Tauri commands must not accept a filesystem path, root, or directory parameter.");
}

if (/environmentReport|environment_report/.test(mcagentClient)) {
  throw new Error("Desktop MCAgent requests must not include an environment report.");
}

console.log("Tauri security check passed: core-only capability; exact controlled-workspace command allowlist; no sidecar, dangerous plugin, process, network, Minecraft-path, OAuth, environment-enumeration, or environment-report API payload.");
