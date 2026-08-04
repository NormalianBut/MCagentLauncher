import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const excludedDirectories = new Set([
  ".git",
  ".next",
  ".pnpm-store",
  ".pytest_cache",
  ".venv",
  "artifacts",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "target",
  "tmp",
  "venv",
  "__pycache__",
]);
const scannedExtensions = new Set([
  ".cjs", ".js", ".jsx", ".json", ".md", ".mjs", ".py", ".rs", ".toml", ".ts", ".tsx",
]);

const rules = [
  {
    id: "filesystem-write-node",
    capability: "filesystem-write",
    pattern: /\b(?:writeFile|appendFile|createWriteStream|mkdir|mkdtemp|rm|rmdir|unlink|rename|copyFile)\s*\(/,
    message: "Node filesystem mutation API found in runtime code.",
  },
  {
    id: "filesystem-write-python",
    capability: "filesystem-write",
    pattern: /(?:\.write_(?:text|bytes)\s*\(|\bopen\s*\([^\n]*,[^\n]*["'][wax+][^"']*["']|\b(?:os|shutil)\.(?:remove|unlink|mkdir|makedirs|rename|replace|rmtree|copy|copyfile|move)\s*\()/,
    message: "Python filesystem mutation API found in runtime code.",
  },
  {
    id: "filesystem-write-rust",
    capability: "filesystem-write",
    pattern: /(?:std::fs::|fs::)(?:write|create_dir|create_dir_all|remove_file|remove_dir|remove_dir_all|rename|copy)\s*\(|OpenOptions::new\s*\(/,
    message: "Rust filesystem mutation API found in runtime code.",
  },
  {
    id: "process-execution-node",
    capability: "process-execution",
    pattern: /(?:node:)?child_process|\b(?:execFile|execSync|spawn|spawnSync|fork)\s*\(/,
    message: "Node child-process execution found in runtime code.",
  },
  {
    id: "process-execution-python",
    capability: "process-execution",
    pattern: /\b(?:subprocess\.(?:run|Popen|call|check_call|check_output)|os\.(?:system|popen)|pty\.spawn)\s*\(/,
    message: "Python process or shell execution found in runtime code.",
  },
  {
    id: "process-execution-rust",
    capability: "process-execution",
    pattern: /(?:std::process::)?Command::new\s*\(|\.sidecar\s*\(/,
    message: "Rust process or sidecar execution found in runtime code.",
  },
  {
    id: "tauri-privileged-plugin",
    capability: "desktop-runtime-privilege",
    pattern: /tauri-plugin-(?:fs|shell|process|updater|autostart|upload)|@tauri-apps\/plugin-(?:fs|shell|process|updater|autostart|upload)/,
    message: "Privileged Tauri runtime plugin found.",
  },
  {
    id: "tauri-sidecar",
    capability: "process-execution",
    pattern: /["']externalBin["']\s*:|\.sidecar\s*\(/,
    message: "Tauri sidecar configuration or execution found.",
  },
  {
    id: "runtime-download",
    capability: "download",
    pattern: /\b(?:downloadFile|downloadToFile|createDownload|electronDownload)\s*\(|(?:node-downloader-helper|electron-dl)/,
    message: "Resource download implementation found in runtime code.",
  },
  {
    id: "oauth-runtime",
    capability: "authentication",
    pattern: /(?:@azure\/msal|passport-microsoft|oauth4webapi|openid-client|tauri-plugin-oauth|microsoft-authentication-library)/i,
    message: "OAuth runtime dependency or implementation found.",
  },
  {
    id: "embedded-secret",
    capability: "secrets",
    pattern: /(?:api[_-]?key|client[_-]?secret|access[_-]?token)\s*[:=]\s*["'][A-Za-z0-9_\-./+=]{16,}["']/i,
    message: "Possible embedded credential found in runtime code.",
  },
];

// DQ-001, DQ-002, and DQ-007 approve this single Desktop-owned module for the
// controlled-workspace vertical slice. Other capability rules still apply to it.
const approvedRuntimeCapabilities = new Map([
  ["apps/desktop/src-tauri/src/controlled_workspace.rs", new Set(["filesystem-write"])],
]);

function relativePath(filePath) {
  return path.relative(repositoryRoot, filePath).split(path.sep).join("/");
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function classify(file) {
  const normalized = relativePath(file).toLowerCase();
  const basename = path.basename(normalized);
  if (normalized.endsWith(".md") || normalized.startsWith("docs/")) return "documentation";
  if (normalized.startsWith("examples/") || normalized.startsWith("datasets/")) return "example-data";
  if (/(^|\/)(tests?|__tests__)(\/|$)|\.(?:test|spec)\.[^.]+$/.test(normalized)) return "test";
  if (normalized.startsWith("scripts/") || normalized.includes("/scripts/") || basename === "build.rs") return "tooling";
  if (normalized.startsWith(".github/") || /(?:^|\/)(?:vite|next)\.config\./.test(normalized)) return "tooling";
  if (basename === "package.json" || basename === "cargo.toml" || basename === "pyproject.toml") return "manifest";
  return "runtime";
}

async function collectFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink() || (entry.isDirectory() && excludedDirectories.has(entry.name))) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(fullPath));
    else if (entry.isFile() && scannedExtensions.has(path.extname(entry.name).toLowerCase())) files.push(fullPath);
  }
  return files;
}

const files = (await collectFiles(repositoryRoot)).sort((left, right) => compareText(relativePath(left), relativePath(right)));
const scannedByClass = {};
const findings = [];
const approvedOccurrences = [];

for (const file of files) {
  const fileClass = classify(file);
  scannedByClass[fileClass] = (scannedByClass[fileClass] ?? 0) + 1;
  if (fileClass !== "runtime" && fileClass !== "manifest") continue;

  const lines = (await readFile(file, "utf8")).split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    for (const rule of rules) {
      if (!rule.pattern.test(lines[index])) continue;
      if (approvedRuntimeCapabilities.get(relativePath(file))?.has(rule.capability)) {
        approvedOccurrences.push({
          ruleId: rule.id,
          capability: rule.capability,
          file: relativePath(file),
          line: index + 1,
        });
        continue;
      }
      findings.push({
        severity: "violation",
        ruleId: rule.id,
        capability: rule.capability,
        file: relativePath(file),
        line: index + 1,
        classification: fileClass,
        message: rule.message,
        evidence: lines[index].trim().slice(0, 200),
      });
    }
  }
}

findings.sort((left, right) => compareText(left.file, right.file) || left.line - right.line || compareText(left.ruleId, right.ruleId));
approvedOccurrences.sort((left, right) => compareText(left.file, right.file) || left.line - right.line || compareText(left.ruleId, right.ruleId));
const report = {
  schemaVersion: "1.0.0",
  check: "mcagentlauncher-autonomy-boundaries",
  repository: path.basename(repositoryRoot),
  policy: {
    networkAccess: false,
    repositoryWrites: false,
    scope: "repository-only",
    failureThreshold: "clear-runtime-violation",
    approvedRuntimeCapabilities: Object.fromEntries([...approvedRuntimeCapabilities].map(([file, capabilities]) => [file, [...capabilities].sort()])),
  },
  summary: {
    passed: findings.length === 0,
    scannedFiles: files.length,
    scannedByClass: Object.fromEntries(Object.entries(scannedByClass).sort(([left], [right]) => compareText(left, right))),
    violations: findings.length,
    approvedOccurrences: approvedOccurrences.length,
  },
  approvedOccurrences,
  findings,
};

console.log(JSON.stringify(report, null, 2));
process.exitCode = findings.length === 0 ? 0 : 1;
