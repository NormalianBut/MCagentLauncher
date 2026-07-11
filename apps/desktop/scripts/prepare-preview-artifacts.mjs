import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(desktopRoot, "..", "..");
const packageJson = JSON.parse(await readFile(path.join(desktopRoot, "package.json"), "utf8"));
const bundleDirectory = path.join(desktopRoot, "src-tauri", "target", "release", "bundle", "nsis");
const outputDirectory = path.join(repoRoot, "artifacts", "desktop-preview");
const entries = await readdir(bundleDirectory, { withFileTypes: true });
const installers = entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".exe"));

if (installers.length !== 1) {
  throw new Error(`Expected exactly one NSIS installer, found ${installers.length}.`);
}

await mkdir(outputDirectory, { recursive: true });
const artifactName = `MCagentlauncher-${packageJson.version}-windows-x64-unsigned-preview.exe`;
const sourcePath = path.join(bundleDirectory, installers[0].name);
const artifactPath = path.join(outputDirectory, artifactName);
await copyFile(sourcePath, artifactPath);

const bytes = await readFile(artifactPath);
const checksum = createHash("sha256").update(bytes).digest("hex");
const manifest = {
  schemaVersion: "1.0.0",
  appName: "MCagentlauncher",
  appVersion: packageJson.version,
  buildChannel: "Native Packaging Preview",
  platform: "windows",
  architecture: "x64",
  unsigned: true,
  serverBundled: false,
  executorEnabled: false,
  updaterEnabled: false,
  artifactFiles: [{ name: artifactName, sha256: checksum, sizeBytes: bytes.length }],
  generatedAt: new Date().toISOString(),
};

await writeFile(path.join(outputDirectory, "desktop-preview-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await writeFile(path.join(outputDirectory, "SHA256SUMS.txt"), `${checksum}  ${artifactName}\n`, "utf8");
console.log(`Prepared ${artifactName} (${bytes.length} bytes)`);
console.log(`SHA-256 ${checksum}`);
