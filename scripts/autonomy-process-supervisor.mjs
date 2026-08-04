import { open } from "node:fs/promises";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  assertMayStartWork,
  controlPath,
  createContext,
  ensureControlDirectory,
  HEARTBEAT_INTERVAL_MS,
  heartbeat,
  isContained,
  leaseIsStale,
  nowIso,
  parseArguments,
  readJson,
  readRegistry,
  runtimeFiles,
  writeRegistry,
} from "./autonomy-runtime.mjs";

function directRun() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

export function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

async function identityRequest(entry, request) {
  return new Promise((resolve) => {
    const socket = net.createConnection(entry.identityEndpoint);
    let data = "";
    const timer = setTimeout(() => socket.destroy(new Error("identity timeout")), 1_500);
    socket.setEncoding("utf8");
    socket.once("connect", () => socket.write(`${request}\n`));
    socket.on("data", (chunk) => { data += chunk; });
    socket.once("end", () => { clearTimeout(timer); resolve(data.trim()); });
    socket.once("error", () => { clearTimeout(timer); resolve(null); });
  });
}

export async function verifyRegisteredIdentity(entry) {
  if (!processIsAlive(entry.pid)) return { alive: false, owned: false, reason: "not-running" };
  if (!entry.identityEndpoint || !entry.ownershipToken) return { alive: true, owned: false, reason: "identity-unavailable" };
  const response = await identityRequest(entry, "challenge");
  const owned = response === `${entry.pid}:${entry.ownershipToken}`;
  return { alive: processIsAlive(entry.pid), owned, reason: owned ? "pid-and-nonce-challenge-match" : "identity-mismatch" };
}

export async function terminateOwnedProcessTree(entry) {
  const identity = await verifyRegisteredIdentity(entry);
  if (!identity.owned) return { terminated: false, identity };
  const response = await identityRequest(entry, `terminate:${entry.ownershipToken}`);
  const deadline = Date.now() + 2_000;
  while (processIsAlive(entry.pid) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  let result = { status: 0, stdout: response ?? "", stderr: "" };
  if (processIsAlive(entry.pid)) {
    result = process.platform === "win32"
      ? spawnSync("taskkill.exe", ["/PID", String(entry.pid), "/T", "/F"], { encoding: "utf8", timeout: 10_000, windowsHide: true })
      : spawnSync("kill", ["-TERM", `-${entry.pid}`], { encoding: "utf8", timeout: 10_000 });
  }
  return {
    terminated: result.status === 0 || !processIsAlive(entry.pid),
    identity,
    status: result.status,
    message: (result.stdout || result.stderr || "").trim(),
  };
}

async function wrapper(argv) {
  const { options, positionals } = parseArguments(argv);
  const token = options.token;
  const identityEndpoint = options["identity-endpoint"];
  if (!token || !identityEndpoint || positionals.length === 0) throw new Error("Invalid supervised wrapper invocation.");
  let child;
  const server = net.createServer((socket) => {
    socket.setEncoding("utf8");
    let request = "";
    socket.on("data", (chunk) => {
      request += chunk;
      if (!request.includes("\n")) return;
      const command = request.trim();
      if (command === "challenge") socket.end(`${process.pid}:${token}\n`);
      else if (command === `terminate:${token}`) {
        if (child && !child.killed) child.kill();
        socket.end("termination-requested\n");
      } else socket.end("rejected\n");
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(identityEndpoint, resolve);
  });
  child = spawn(positionals[0], positionals.slice(1), {
    cwd: options.cwd,
    stdio: "inherit",
    windowsHide: true,
    env: { ...process.env, MCAGENT_AUTONOMY_PROCESS_TOKEN: token },
  });
  const forward = (signal) => {
    if (!child.killed) child.kill(signal);
  };
  process.on("SIGTERM", () => forward("SIGTERM"));
  process.on("SIGINT", () => forward("SIGINT"));
  const result = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  await new Promise((resolve) => server.close(resolve));
  process.exitCode = result.code ?? (result.signal ? 1 : 0);
}

export async function runSupervised(input, overrides = {}) {
  const context = createContext(overrides);
  await assertMayStartWork(context, "long-running process");
  await ensureControlDirectory(context);
  if (!input.command || !input.purpose) throw new Error("A command and purpose are required.");
  const lease = await readJson(context, runtimeFiles.lease, { optional: true });
  if (!lease || lease.runId !== input.runId || leaseIsStale(lease)) {
    throw new Error("A matching active coordinator lease is required before process supervision.");
  }
  const timeoutMs = Number(input.timeoutMs);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 86_400_000) {
    throw new Error("timeoutMs must be between 100 and 86400000.");
  }
  const workingDirectory = path.resolve(input.cwd ?? context.repositoryRoot);
  if (workingDirectory !== context.repositoryRoot && !isContained(context.repositoryRoot, workingDirectory)) {
    throw new Error("Supervised process working directory must remain inside the active worktree.");
  }
  if (["java", "java.exe", "javaw", "javaw.exe"].includes(path.basename(input.command).toLowerCase())) {
    throw new Error("Java execution is outside this Autonomy Lab bootstrap scope.");
  }
  const token = randomUUID();
  const identityEndpoint = process.platform === "win32"
    ? `\\\\.\\pipe\\mcagent-autonomy-${token}`
    : path.join(context.controlDirectory, `.process-${token}.sock`);
  const logStem = `${Date.now()}-${token}`;
  const stdoutLog = path.join(controlPath(context, "logs"), `${logStem}.stdout.log`);
  const stderrLog = path.join(controlPath(context, "logs"), `${logStem}.stderr.log`);
  if (!isContained(context.controlDirectory, stdoutLog) || !isContained(context.controlDirectory, stderrLog)) {
    throw new Error("Log path escaped the control directory.");
  }
  const stdout = await open(stdoutLog, "wx", 0o600);
  const stderr = await open(stderrLog, "wx", 0o600);
  const wrapperArgs = [
    fileURLToPath(import.meta.url), "__wrapper", `--token=${token}`, `--identity-endpoint=${identityEndpoint}`, `--cwd=${workingDirectory}`,
    "--", input.command, ...(input.args ?? []),
  ];
  const child = spawn(process.execPath, wrapperArgs, {
    cwd: context.repositoryRoot,
    detached: true,
    stdio: ["ignore", stdout.fd, stderr.fd],
    windowsHide: true,
  });
  await new Promise((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", reject);
  });
  const entry = {
    schemaVersion: "1.0.0",
    runId: input.runId,
    pid: child.pid,
    executableIdentity: process.execPath,
    ownershipToken: token,
    identityEndpoint,
    commandPurpose: input.purpose,
    workingDirectory,
    stdoutLog,
    stderrLog,
    startedAt: nowIso(),
    timeoutMs,
    cleanupPolicy: input.cleanupPolicy ?? "terminate-on-pause",
    expectedChildProcesses: [path.basename(input.command)],
    status: "running",
  };
  const registry = await readRegistry(context);
  await writeRegistry(context, [...registry.processes.filter((item) => item.ownershipToken !== token), entry]);
  let timedOut = false;
  const heartbeatTimer = setInterval(() => {
    heartbeat(context, input.runId).catch(async () => terminateOwnedProcessTree(entry));
  }, HEARTBEAT_INTERVAL_MS);
  const timer = setTimeout(async () => {
    timedOut = true;
    await terminateOwnedProcessTree(entry);
  }, timeoutMs);
  const result = await new Promise((resolve) => {
    child.once("error", (error) => resolve({ code: null, signal: null, error: error.message }));
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  clearTimeout(timer);
  clearInterval(heartbeatTimer);
  await stdout.close();
  await stderr.close();
  const latest = await readRegistry(context);
  await writeRegistry(context, latest.processes.map((item) => item.ownershipToken === token
    ? { ...item, status: timedOut ? "timed-out" : result.code === 0 ? "completed" : "failed", endedAt: nowIso(), exitCode: result.code, signal: result.signal }
    : item));
  return { ...result, timedOut, entry };
}

export async function inspectRegisteredProcesses(context) {
  const registry = await readRegistry(context);
  return Promise.all(registry.processes.map(async (entry) => ({ entry, identity: await verifyRegisteredIdentity(entry) })));
}

export async function terminateDisposableProcesses(context, reason = "pause") {
  const inspections = await inspectRegisteredProcesses(context);
  const results = [];
  for (const inspection of inspections) {
    if (!inspection.identity.alive || inspection.entry.status !== "running") continue;
    if (!inspection.entry.cleanupPolicy.startsWith("terminate")) {
      results.push({ pid: inspection.entry.pid, terminated: false, reason: "cleanup-policy-preserves-process" });
      continue;
    }
    const result = await terminateOwnedProcessTree(inspection.entry);
    results.push({ pid: inspection.entry.pid, reason, ...result });
  }
  const registry = await readRegistry(context);
  await writeRegistry(context, registry.processes.map((entry) => {
    const result = results.find((item) => item.pid === entry.pid && item.terminated);
    return result ? { ...entry, status: "terminated", endedAt: nowIso(), terminationReason: reason } : entry;
  }));
  return results;
}

export async function runSupervisor(argv = process.argv.slice(2), overrides = {}) {
  const command = argv[0];
  if (command === "__wrapper") return wrapper(argv.slice(1));
  const separator = argv.indexOf("--");
  const controlArgs = separator < 0 ? argv.slice(1) : argv.slice(1, separator);
  const childArgs = separator < 0 ? [] : argv.slice(separator + 1);
  const { options } = parseArguments(controlArgs);
  if (command === "inspect") return inspectRegisteredProcesses(createContext(overrides));
  if (command !== "run" || childArgs.length === 0) {
    throw new Error("Usage: autonomy-process-supervisor.mjs run --purpose <text> --run-id <id> --timeout-ms <ms> -- <command> [args]");
  }
  return runSupervised({
    runId: options["run-id"], purpose: options.purpose, timeoutMs: options["timeout-ms"],
    cleanupPolicy: options["cleanup-policy"], cwd: options.cwd, command: childArgs[0], args: childArgs.slice(1),
  }, overrides);
}

if (directRun()) {
  runSupervisor().then((result) => {
    if (result !== undefined) console.log(JSON.stringify(result, null, 2));
  }).catch((error) => {
    console.error(`${error.code ?? error.name}: ${error.message}`);
    process.exitCode = 1;
  });
}
