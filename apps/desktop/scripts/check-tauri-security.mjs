import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const capability = JSON.parse(await readFile(path.join(desktopRoot, "src-tauri", "capabilities", "default.json"), "utf8"));
const cargoToml = await readFile(path.join(desktopRoot, "src-tauri", "Cargo.toml"), "utf8");
const mainRs = await readFile(path.join(desktopRoot, "src-tauri", "src", "main.rs"), "utf8");
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

if (/invoke_handler|generate_handler|Command::|sidecar\s*\(/.test(mainRs)) {
  throw new Error("Desktop main.rs must not expose commands or sidecars in M12.");
}

if (/environmentReport|environment_report/.test(mcagentClient)) {
  throw new Error("Desktop MCAgent requests must not include an environment report.");
}

console.log("Tauri security check passed: core-only capability; no commands, sidecar, dangerous plugins, or environment-report API payload.");
