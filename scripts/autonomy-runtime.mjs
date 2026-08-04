import {
  access,
  mkdir,
  open,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const HEARTBEAT_INTERVAL_MS = 15_000;
export const LEASE_DURATION_MS = 45_000;
export const DEFAULT_PAUSE_TIMEOUT_MS = 30_000;
export const runtimeFiles = Object.freeze({
  state: "run-state.json",
  lease: "lease.json",
  processes: "process-registry.json",
  operation: "current-operation.json",
  heartbeat: "last-heartbeat.json",
  pause: "PAUSE",
  stop: "STOP",
});

export class RuntimeError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "RuntimeError";
    this.code = code;
    this.details = details;
  }
}

export function nowIso(now = Date.now()) {
  return new Date(now).toISOString();
}

export function defaultControlDirectory(environment = process.env) {
  if (environment.MCAGENT_AUTONOMY_CONTROL_DIR) {
    return path.resolve(environment.MCAGENT_AUTONOMY_CONTROL_DIR);
  }
  const base = process.platform === "win32"
    ? environment.LOCALAPPDATA
    : environment.XDG_STATE_HOME;
  if (!base) {
    throw new RuntimeError(
      "CONTROL_DIRECTORY_NOT_CONFIGURED",
      "Set MCAGENT_AUTONOMY_CONTROL_DIR (or the platform state-directory variable).",
    );
  }
  return path.resolve(base, "MCagentlauncher", "autonomy-lab");
}

export function isContained(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

export function assertControlDirectory(controlDirectory, repoRoot = repositoryRoot) {
  const resolved = path.resolve(controlDirectory);
  const repo = path.resolve(repoRoot);
  if (resolved === path.parse(resolved).root) {
    throw new RuntimeError("UNSAFE_CONTROL_DIRECTORY", "The control directory cannot be a filesystem root.");
  }
  if (resolved === repo || isContained(repo, resolved)) {
    throw new RuntimeError("CONTROL_DIRECTORY_IN_REPOSITORY", "The control directory must be outside the Git worktree.");
  }
  return resolved;
}

export function controlPath(context, filename) {
  if (!Object.values(runtimeFiles).includes(filename) && filename !== "logs" && filename !== "evidence") {
    throw new RuntimeError("UNKNOWN_RUNTIME_FILE", `Refusing unknown control path: ${filename}`);
  }
  const target = path.resolve(context.controlDirectory, filename);
  if (!isContained(context.controlDirectory, target)) {
    throw new RuntimeError("CONTROL_PATH_ESCAPE", `Control path escaped configured root: ${filename}`);
  }
  return target;
}

export function createContext(options = {}) {
  const repoRoot = path.resolve(options.repositoryRoot ?? repositoryRoot);
  const controlDirectory = assertControlDirectory(
    options.controlDirectory ?? defaultControlDirectory(options.environment),
    repoRoot,
  );
  return { controlDirectory, repositoryRoot: repoRoot };
}

export async function ensureControlDirectory(context) {
  await mkdir(context.controlDirectory, { recursive: true, mode: 0o700 });
  await mkdir(controlPath(context, "logs"), { recursive: true, mode: 0o700 });
  await mkdir(controlPath(context, "evidence"), { recursive: true, mode: 0o700 });
}

export async function exists(target) {
  try {
    await access(target, fsConstants.F_OK);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

export async function readJson(context, filename, { optional = false } = {}) {
  const target = controlPath(context, filename);
  try {
    const text = await readFile(target, "utf8");
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("top-level JSON value must be an object");
    }
    return value;
  } catch (error) {
    if (optional && error?.code === "ENOENT") return null;
    if (error instanceof RuntimeError) throw error;
    throw new RuntimeError("CORRUPT_RUNTIME_STATE", `${filename} is missing or invalid: ${error.message}`, { filename });
  }
}

export async function atomicWriteJson(context, filename, value) {
  await ensureControlDirectory(context);
  const target = controlPath(context, filename);
  const temporary = `${target}.tmp-${process.pid}-${randomUUID()}`;
  if (!isContained(context.controlDirectory, temporary)) {
    throw new RuntimeError("CONTROL_PATH_ESCAPE", "Temporary publication path escaped the control root.");
  }
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
}

export async function writeSentinel(context, filename, value) {
  await ensureControlDirectory(context);
  await writeFile(controlPath(context, filename), `${JSON.stringify(value)}\n`, { encoding: "utf8", mode: 0o600 });
}

export async function removeSentinel(context, filename) {
  await rm(controlPath(context, filename), { force: true });
}

export async function assertMayStartWork(context, phase) {
  if (await exists(controlPath(context, runtimeFiles.stop))) {
    throw new RuntimeError("STOP_REQUESTED", `STOP is set; refusing ${phase}.`);
  }
  if (await exists(controlPath(context, runtimeFiles.pause))) {
    throw new RuntimeError("PAUSE_REQUESTED", `PAUSE is set; refusing ${phase}.`);
  }
}

export function coordinatorIdentity() {
  return {
    hostname: os.hostname(),
    platform: process.platform,
    executable: process.execPath,
    pid: process.pid,
  };
}

export function leaseIsStale(lease, now = Date.now()) {
  const expiry = Date.parse(lease?.expiresAt ?? "");
  return !Number.isFinite(expiry) || expiry <= now;
}

export async function acquireLease(context, input, now = Date.now()) {
  await assertMayStartWork(context, "coordinator acquisition");
  await ensureControlDirectory(context);
  const target = controlPath(context, runtimeFiles.lease);
  const lease = {
    schemaVersion: "1.0.0",
    runId: input.runId ?? randomUUID(),
    coordinator: coordinatorIdentity(),
    branch: input.branch,
    worktree: path.resolve(input.worktree ?? context.repositoryRoot),
    objective: input.objective,
    createdAt: nowIso(now),
    lastHeartbeatAt: nowIso(now),
    expiresAt: nowIso(now + LEASE_DURATION_MS),
  };
  let handle;
  try {
    handle = await open(target, "wx", 0o600);
    await handle.writeFile(`${JSON.stringify(lease, null, 2)}\n`, "utf8");
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const existing = await readJson(context, runtimeFiles.lease);
    throw new RuntimeError(
      leaseIsStale(existing, now) ? "STALE_LEASE_REQUIRES_RECOVERY" : "COMPETING_COORDINATOR",
      leaseIsStale(existing, now)
        ? "A stale lease exists; run autonomy:doctor and autonomy:resume before acquiring a new lease."
        : "An active coordinator already owns this control directory.",
      { existing },
    );
  } finally {
    await handle?.close();
  }
  return lease;
}

export async function heartbeat(context, runId, now = Date.now()) {
  const lease = await readJson(context, runtimeFiles.lease);
  if (lease.runId !== runId) throw new RuntimeError("LEASE_OWNERSHIP_MISMATCH", "Run ID does not own the lease.");
  await assertMayStartWork(context, "heartbeat continuation");
  const next = { ...lease, lastHeartbeatAt: nowIso(now), expiresAt: nowIso(now + LEASE_DURATION_MS) };
  await atomicWriteJson(context, runtimeFiles.lease, next);
  await atomicWriteJson(context, runtimeFiles.heartbeat, {
    schemaVersion: "1.0.0",
    runId,
    recordedAt: next.lastHeartbeatAt,
    nextDueAt: nowIso(now + HEARTBEAT_INTERVAL_MS),
  });
  return next;
}

export async function writeRunState(context, state) {
  const value = { schemaVersion: "1.0.0", updatedAt: nowIso(), ...state };
  await atomicWriteJson(context, runtimeFiles.state, value);
  return value;
}

export async function saveOperation(context, operation) {
  const value = { schemaVersion: "1.0.0", updatedAt: nowIso(), ...operation };
  await atomicWriteJson(context, runtimeFiles.operation, value);
  return value;
}

export async function clearOperation(context) {
  await rm(controlPath(context, runtimeFiles.operation), { force: true });
}

export async function readRegistry(context) {
  const registry = await readJson(context, runtimeFiles.processes, { optional: true });
  return registry ?? { schemaVersion: "1.0.0", updatedAt: nowIso(), processes: [] };
}

export async function writeRegistry(context, processes) {
  return atomicWriteJson(context, runtimeFiles.processes, {
    schemaVersion: "1.0.0",
    updatedAt: nowIso(),
    processes: [...processes].sort((left, right) => left.startedAt.localeCompare(right.startedAt) || left.pid - right.pid),
  });
}

export function inspectGit(repoRoot = repositoryRoot) {
  const run = (args) => {
    const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8", timeout: 10_000, windowsHide: true });
    return result.status === 0 ? result.stdout.trim() : `ERROR: ${(result.stderr || result.error?.message || "git failed").trim()}`;
  };
  return {
    branch: run(["branch", "--show-current"]),
    head: run(["rev-parse", "HEAD"]),
    status: run(["status", "--short"]),
    worktrees: run(["worktree", "list", "--porcelain"]),
  };
}

export async function writeResumePacket(context, details) {
  const target = path.join(context.repositoryRoot, "docs", "execution", "resume-packet.md");
  const temporary = `${target}.tmp-${process.pid}-${randomUUID()}`;
  if (!isContained(context.repositoryRoot, target) || !isContained(context.repositoryRoot, temporary)) {
    throw new RuntimeError("RESUME_PACKET_PATH_ESCAPE", "Resume packet path escaped the active worktree.");
  }
  const operation = details.operation ?? await readJson(context, runtimeFiles.operation, { optional: true }).catch((error) => ({ error: error.message }));
  const git = details.git ?? inspectGit(context.repositoryRoot);
  const content = `# Autonomy Lab Resume Packet\n\n` +
    `- Updated: ${nowIso()}\n` +
    `- Runtime state: ${details.state}\n` +
    `- Run ID: ${details.runId ?? "none"}\n` +
    `- Branch: ${git.branch || "unknown"}\n` +
    `- HEAD: ${git.head || "unknown"}\n` +
    `- Exact next action: ${details.nextAction ?? operation?.nextAction ?? "Run pnpm.cmd autonomy:doctor before continuing."}\n\n` +
    `## Current Operation\n\n\`\`\`json\n${JSON.stringify(operation, null, 2)}\n\`\`\`\n\n` +
    `## Git Status\n\n\`\`\`text\n${git.status || "clean"}\n\`\`\`\n\n` +
    `## Recovery Notes\n\n${details.notes ?? "Inspect evidence before cleanup. Never reset or delete uncommitted work or feature branches automatically."}\n`;
  try {
    await writeFile(temporary, content, { encoding: "utf8", flag: "wx" });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
  return target;
}

export async function runtimeSnapshot(context) {
  const safeRead = async (filename) => {
    try {
      return await readJson(context, filename, { optional: true });
    } catch (error) {
      return { error: error.code ?? "READ_FAILED", message: error.message };
    }
  };
  return {
    controlDirectory: context.controlDirectory,
    sentinels: {
      pause: await exists(controlPath(context, runtimeFiles.pause)),
      stop: await exists(controlPath(context, runtimeFiles.stop)),
    },
    state: await safeRead(runtimeFiles.state),
    lease: await safeRead(runtimeFiles.lease),
    heartbeat: await safeRead(runtimeFiles.heartbeat),
    operation: await safeRead(runtimeFiles.operation),
    registry: await safeRead(runtimeFiles.processes),
  };
}

export function parseArguments(argv) {
  const positionals = [];
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") {
      positionals.push(...argv.slice(index + 1));
      break;
    }
    if (!item.startsWith("--")) {
      positionals.push(item);
      continue;
    }
    const [key, inline] = item.slice(2).split("=", 2);
    if (inline !== undefined) options[key] = inline;
    else if (argv[index + 1] && !argv[index + 1].startsWith("--")) options[key] = argv[++index];
    else options[key] = true;
  }
  return { options, positionals };
}

export async function preserveEvidence(context, name, value) {
  await ensureControlDirectory(context);
  const safeName = name.replace(/[^A-Za-z0-9._-]/g, "_");
  const target = path.join(controlPath(context, "evidence"), `${nowIso().replace(/[:.]/g, "-")}-${safeName}.json`);
  if (!isContained(context.controlDirectory, target)) throw new RuntimeError("CONTROL_PATH_ESCAPE", "Evidence path escaped control root.");
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  return target;
}

export async function removeLeaseIfOwned(context, runId) {
  const lease = await readJson(context, runtimeFiles.lease, { optional: true });
  if (!lease) return false;
  if (lease.runId !== runId) throw new RuntimeError("LEASE_OWNERSHIP_MISMATCH", "Refusing to remove another run's lease.");
  await rm(controlPath(context, runtimeFiles.lease));
  return true;
}

export async function fileMetadata(target) {
  try {
    const info = await stat(target);
    return { exists: true, size: info.size, modifiedAt: info.mtime.toISOString() };
  } catch (error) {
    if (error?.code === "ENOENT") return { exists: false };
    throw error;
  }
}

export function isOwnedTemporaryPublication(filename) {
  return [runtimeFiles.state, runtimeFiles.lease, runtimeFiles.processes, runtimeFiles.operation, runtimeFiles.heartbeat]
    .some((runtimeFilename) => filename.startsWith(`${runtimeFilename}.tmp-`));
}

export function detectResourceMode(environment = process.env) {
  const freeRatio = os.freemem() / os.totalmem();
  const explicitlyIdle = environment.MCAGENT_AUTONOMY_MACHINE_IDLE === "1";
  const memorySafe = Number.isFinite(freeRatio) && freeRatio >= 0.2;
  return {
    mode: explicitlyIdle && memorySafe ? "MACHINE_IDLE" : "USER_ACTIVE",
    evidence: {
      explicitIdleSignal: explicitlyIdle,
      freeMemoryRatio: Number(freeRatio.toFixed(3)),
      memoryThresholdMet: memorySafe,
      uncertainStateFallsBackToUserActive: true,
    },
  };
}
