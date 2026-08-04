import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, test } from "node:test";
import {
  acquireLease, assertControlDirectory, atomicWriteJson, controlPath, createContext,
  detectResourceMode, heartbeat, leaseIsStale, nowIso, readJson, runtimeFiles, saveOperation,
  writeRegistry, writeRunState,
} from "../scripts/autonomy-runtime.mjs";
import { pauseRuntime } from "../scripts/autonomy-pause.mjs";
import { resumeRuntime } from "../scripts/autonomy-resume.mjs";
import { diagnoseRuntime } from "../scripts/autonomy-doctor.mjs";
import { cleanupRuntime } from "../scripts/autonomy-cleanup.mjs";
import {
  runSupervised, terminateOwnedProcessTree, verifyRegisteredIdentity,
} from "../scripts/autonomy-process-supervisor.mjs";

const disposables = [];

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "mcagent-autonomy-test-"));
  disposables.push(root);
  const repo = path.join(root, "repo");
  const control = path.join(root, "control");
  await mkdir(path.join(repo, "docs", "execution"), { recursive: true });
  const overrides = { repositoryRoot: repo, controlDirectory: control };
  return { root, repo, control, overrides, context: createContext(overrides) };
}

afterEach(async () => {
  for (const target of disposables.splice(0)) await rm(target, { recursive: true, force: true });
});

function initializeGit(repo) {
  for (const args of [
    ["init", "-b", "codex/test"], ["config", "user.email", "test@example.invalid"],
    ["config", "user.name", "Autonomy Test"],
  ]) {
    const result = spawnSync("git", args, { cwd: repo, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
  }
}

test("control directory must stay outside the repository", async () => {
  const item = await fixture();
  assert.throws(() => assertControlDirectory(path.join(item.repo, ".control"), item.repo), { code: "CONTROL_DIRECTORY_IN_REPOSITORY" });
  assert.equal(assertControlDirectory(item.control, item.repo), item.control);
});

test("missing and corrupt run state are diagnosed without mutation", async () => {
  const item = await fixture();
  let diagnosis = await diagnoseRuntime(item.overrides);
  assert.ok(diagnosis.issues.some((issue) => issue.code === "MISSING_RUN_STATE"));
  await mkdir(item.control, { recursive: true });
  await writeFile(controlPath(item.context, runtimeFiles.state), "{broken", "utf8");
  diagnosis = await diagnoseRuntime(item.overrides);
  assert.ok(diagnosis.issues.some((issue) => issue.code === "CORRUPT_RUN_STATE"));
});

test("single coordinator rejects a competitor and requires recovery for stale lease", async () => {
  const item = await fixture();
  const lease = await acquireLease(item.context, { branch: "codex/test", worktree: item.repo, objective: "test" }, 1_000);
  await assert.rejects(() => acquireLease(item.context, { branch: "codex/test", worktree: item.repo, objective: "other" }, 1_001), { code: "COMPETING_COORDINATOR" });
  assert.equal(leaseIsStale(lease, 1_000), false);
  await assert.rejects(() => acquireLease(item.context, { branch: "codex/test", worktree: item.repo, objective: "other" }, 100_000), { code: "STALE_LEASE_REQUIRES_RECOVERY" });
});

test("heartbeat extends only the owning lease", async () => {
  const item = await fixture();
  const lease = await acquireLease(item.context, { branch: "codex/test", worktree: item.repo, objective: "test" }, 1_000);
  const renewed = await heartbeat(item.context, lease.runId, 2_000);
  assert.equal(renewed.lastHeartbeatAt, nowIso(2_000));
  await assert.rejects(() => heartbeat(item.context, "other-run", 3_000), { code: "LEASE_OWNERSHIP_MISMATCH" });
});

test("clean pause is repeatable and resume restores the exact next action", async () => {
  const item = await fixture();
  initializeGit(item.repo);
  await writeRunState(item.context, { runId: "run-1", status: "running", nextAction: "Run focused test A." });
  await saveOperation(item.context, { runId: "run-1", active: false, nextAction: "Run focused test A." });
  const first = await pauseRuntime(["--timeout-ms", "0"], item.overrides);
  const second = await pauseRuntime(["--timeout-ms", "0"], item.overrides);
  assert.equal(first.safelyPaused, true);
  assert.equal(second.repeated, true);
  const resumed = await resumeRuntime([], item.overrides);
  assert.equal(resumed.resumed, true);
  assert.equal(resumed.nextAction, "Run focused test A.");
  assert.equal(await readFile(path.join(item.repo, "docs", "execution", "resume-packet.md"), "utf8").then((text) => text.includes("Run focused test A.")), true);
});

test("crash/stale lease recovery preserves evidence and work-package state", async () => {
  const item = await fixture();
  initializeGit(item.repo);
  await writeFile(path.join(item.repo, "uncommitted.txt"), "keep me", "utf8");
  await atomicWriteJson(item.context, runtimeFiles.lease, {
    schemaVersion: "1.0.0", runId: "abandoned", branch: "codex/test", worktree: item.repo,
    objective: "crashed", createdAt: nowIso(1), lastHeartbeatAt: nowIso(1), expiresAt: nowIso(2),
  });
  await writeRunState(item.context, { runId: "abandoned", status: "running", nextAction: "Continue exact unit." });
  await saveOperation(item.context, { runId: "abandoned", active: false, nextAction: "Continue exact unit." });
  const resumed = await resumeRuntime([], item.overrides);
  assert.equal(resumed.resumed, true);
  assert.match(resumed.git.status, /uncommitted\.txt/);
  assert.equal(await readFile(path.join(item.repo, "uncommitted.txt"), "utf8"), "keep me");
  assert.equal(resumed.nextAction, "Continue exact unit.");
});

test("failed child process preserves stdout and stderr logs", async () => {
  const item = await fixture();
  await acquireLease(item.context, { runId: "run-fail", branch: "codex/test", worktree: item.repo, objective: "failure test" });
  const result = await runSupervised({
    runId: "run-fail", purpose: "harmless failure fixture", timeoutMs: 10_000,
    command: process.execPath, args: ["-e", "console.log('out-evidence'); console.error('err-evidence'); process.exit(7)"],
  }, item.overrides);
  assert.equal(result.code, 7);
  assert.match(await readFile(result.entry.stdoutLog, "utf8"), /out-evidence/);
  assert.match(await readFile(result.entry.stderrLog, "utf8"), /err-evidence/);
  const registry = await readJson(item.context, runtimeFiles.processes);
  assert.equal(registry.processes[0].status, "failed");
});

test("bounded child timeout terminates its registered process tree", { timeout: 20_000 }, async () => {
  const item = await fixture();
  await acquireLease(item.context, { runId: "run-timeout", branch: "codex/test", worktree: item.repo, objective: "timeout test" });
  const result = await runSupervised({
    runId: "run-timeout", purpose: "harmless timeout fixture", timeoutMs: 700,
    command: process.execPath, args: ["-e", "setTimeout(() => {}, 60000)"],
  }, item.overrides);
  assert.equal(result.timedOut, true);
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.equal((await verifyRegisteredIdentity(result.entry)).alive, false);
});

test("pause during bounded child process terminates only the registered wrapper", { timeout: 20_000 }, async () => {
  const item = await fixture();
  initializeGit(item.repo);
  await writeRunState(item.context, { runId: "run-pause", status: "running", nextAction: "Resume harmless child test." });
  await saveOperation(item.context, { runId: "run-pause", active: false, nextAction: "Resume harmless child test." });
  await acquireLease(item.context, { runId: "run-pause", branch: "codex/test", worktree: item.repo, objective: "pause test" });
  const running = runSupervised({
    runId: "run-pause", purpose: "pause fixture", timeoutMs: 15_000,
    command: process.execPath, args: ["-e", "setTimeout(() => {}, 60000)"],
  }, item.overrides);
  await new Promise((resolve) => setTimeout(resolve, 500));
  const paused = await pauseRuntime(["--timeout-ms", "0"], item.overrides);
  const result = await running;
  assert.equal(paused.safelyPaused, true);
  assert.ok(paused.terminatedProcesses.some((entry) => entry.terminated));
  assert.notEqual(result.code, 0);
});

test("reused PID defense refuses to terminate a mismatched process", async () => {
  const entry = { pid: process.pid, ownershipToken: "definitely-not-present", status: "running", cleanupPolicy: "terminate-on-pause" };
  const identity = await verifyRegisteredIdentity(entry);
  assert.equal(identity.alive, true);
  assert.equal(identity.owned, false);
  assert.equal((await terminateOwnedProcessTree(entry)).terminated, false);
});

test("cleanup is idempotent, removes only owned temp publications, and keeps logs", async () => {
  const item = await fixture();
  await mkdir(path.join(item.control, "logs"), { recursive: true });
  await writeFile(path.join(item.control, "run-state.json.tmp-owned"), "partial", "utf8");
  await writeFile(path.join(item.control, "unrelated.tmp-user"), "keep", "utf8");
  await writeFile(path.join(item.control, "logs", "keep.log"), "evidence", "utf8");
  await writeRegistry(item.context, []);
  const first = await cleanupRuntime(item.overrides);
  const second = await cleanupRuntime(item.overrides);
  assert.equal(first.removed.length, 1);
  assert.deepEqual(second.removed, []);
  assert.equal(await readFile(path.join(item.control, "logs", "keep.log"), "utf8"), "evidence");
  assert.equal(await readFile(path.join(item.control, "unrelated.tmp-user"), "utf8"), "keep");
});

test("doctor is idempotent and resource uncertainty fails to USER_ACTIVE", async () => {
  const item = await fixture();
  const first = await diagnoseRuntime(item.overrides);
  const second = await diagnoseRuntime(item.overrides);
  assert.deepEqual(first.issues, second.issues);
  assert.equal(detectResourceMode({}).mode, "USER_ACTIVE");
});

test("corrupt state blocks resume without deleting work", async () => {
  const item = await fixture();
  initializeGit(item.repo);
  await writeFile(path.join(item.repo, "keep.txt"), "keep", "utf8");
  await mkdir(item.control, { recursive: true });
  await writeFile(controlPath(item.context, runtimeFiles.state), "not-json", "utf8");
  const result = await resumeRuntime([], item.overrides);
  assert.equal(result.resumed, false);
  assert.ok(result.blockedBy.some((issue) => issue.code === "CORRUPT_RUN_STATE"));
  assert.equal(await readFile(path.join(item.repo, "keep.txt"), "utf8"), "keep");
});

test("STOP persists until an explicit clear-stop resume", async () => {
  const item = await fixture();
  initializeGit(item.repo);
  await writeRunState(item.context, { runId: "stopped", status: "running", nextAction: "Inspect stop cause." });
  await saveOperation(item.context, { runId: "stopped", active: false, nextAction: "Inspect stop cause." });
  await pauseRuntime(["--timeout-ms", "0", "--stop"], item.overrides);
  const blocked = await resumeRuntime([], item.overrides);
  assert.equal(blocked.resumed, false);
  assert.ok(blocked.blockedBy.some((issue) => issue.code === "STOP_SENTINEL_SET"));
  const resumed = await resumeRuntime(["--clear-stop"], item.overrides);
  assert.equal(resumed.resumed, true);
});

test("supervisor rejects out-of-worktree cwd and Java", async () => {
  const item = await fixture();
  await acquireLease(item.context, { runId: "guard", branch: "codex/test", worktree: item.repo, objective: "guard test" });
  await assert.rejects(() => runSupervised({
    runId: "guard", purpose: "reject cwd", timeoutMs: 1_000, cwd: item.control,
    command: process.execPath, args: ["-e", "process.exit(0)"],
  }, item.overrides), /working directory/);
  await assert.rejects(() => runSupervised({
    runId: "guard", purpose: "reject java", timeoutMs: 1_000,
    command: "java.exe", args: ["-version"],
  }, item.overrides), /Java execution/);
});
