import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  controlPath, createContext, inspectGit, leaseIsStale, nowIso, parseArguments, preserveEvidence,
  readJson, removeSentinel, runtimeFiles, writeResumePacket, writeRunState,
} from "./autonomy-runtime.mjs";
import { diagnoseRuntime } from "./autonomy-doctor.mjs";
import { terminateDisposableProcesses } from "./autonomy-process-supervisor.mjs";

export async function resumeRuntime(argv = process.argv.slice(2), overrides = {}) {
  const { options } = parseArguments(argv);
  const context = createContext(overrides);
  const diagnosis = await diagnoseRuntime(overrides);
  const lease = await readJson(context, runtimeFiles.lease, { optional: true }).catch((error) => ({ error: error.message }));
  const operation = await readJson(context, runtimeFiles.operation, { optional: true }).catch((error) => ({ error: error.message }));
  const state = await readJson(context, runtimeFiles.state, { optional: true }).catch((error) => ({ error: error.message }));
  const evidence = await preserveEvidence(context, "resume-inspection", { diagnosis, lease, operation, state });
  const unsafe = diagnosis.issues.filter((issue) => issue.severity === "error");
  if (unsafe.length > 0) {
    return { resumed: false, evidence, blockedBy: unsafe, nextAction: "Resolve doctor errors without deleting or resetting work." };
  }
  if (diagnosis.snapshot.sentinels.stop && options["clear-stop"] !== true) {
    return { resumed: false, evidence, blockedBy: [{ code: "STOP_SENTINEL_SET" }], nextAction: "Inspect the emergency stop cause, then rerun with --clear-stop only when safe." };
  }
  const processCleanup = await terminateDisposableProcesses(context, "resume-orphan-recovery");
  if (lease && !lease.error) {
    if (!leaseIsStale(lease) && state?.status !== "paused") {
      return { resumed: false, evidence, blockedBy: [{ code: "ACTIVE_LEASE" }], nextAction: "The existing coordinator still owns the worktree." };
    }
    await rm(controlPath(context, runtimeFiles.lease), { force: true });
  }
  await removeSentinel(context, runtimeFiles.pause);
  if (options["clear-stop"] === true) await removeSentinel(context, runtimeFiles.stop);
  const nextAction = operation?.nextAction ?? state?.nextAction ?? "Inspect the feature branch and define the next bounded work unit.";
  const git = inspectGit(context.repositoryRoot);
  await writeRunState(context, { runId: state?.runId, status: "ready-to-resume", recoveredAt: nowIso(), nextAction });
  await writeResumePacket(context, {
    state: "ready-to-resume", runId: state?.runId, nextAction, operation, git,
    notes: "Recovery inspection was preserved in the external evidence directory. No Git reset, branch deletion, or uncommitted-work deletion was performed.",
  });
  return { resumed: true, evidence, nextAction, git, processCleanup };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  resumeRuntime().then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => {
    console.error(`${error.code ?? error.name}: ${error.message}`);
    process.exitCode = 1;
  });
}
