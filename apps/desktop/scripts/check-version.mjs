import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(path.join(desktopRoot, "package.json"), "utf8"));
const tauriConfig = JSON.parse(await readFile(path.join(desktopRoot, "src-tauri", "tauri.conf.json"), "utf8"));
const cargoToml = await readFile(path.join(desktopRoot, "src-tauri", "Cargo.toml"), "utf8");
const cargoVersion = cargoToml.match(/^version\s*=\s*"([^"]+)"/m)?.[1];

const versions = {
  "apps/desktop/package.json": packageJson.version,
  "apps/desktop/src-tauri/tauri.conf.json": tauriConfig.version,
  "apps/desktop/src-tauri/Cargo.toml": cargoVersion,
};
const uniqueVersions = new Set(Object.values(versions));

if (uniqueVersions.size !== 1 || uniqueVersions.has(undefined)) {
  console.error("Desktop application versions do not match:");
  for (const [file, version] of Object.entries(versions)) {
    console.error(`- ${file}: ${version ?? "missing"}`);
  }
  process.exit(1);
}

console.log(`Desktop version check passed: ${packageJson.version}`);
