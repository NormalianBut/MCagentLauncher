import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createContext, DEFAULT_PAUSE_TIMEOUT_MS, nowIso, parseArguments, readJson, runtimeFiles,
  saveOperation, writeResumePacket, writeRunState, writeSentinel,
} from "./autonomy-runtime.mjs";
import { terminateDisposableProcesses } from "./autonomy-process-supervisor.mjs";

export async function pauseRuntime(argv = process.argv.slice(2), overrides = {}) {
  const { options } = parseArguments(argv);
  const timeoutMs = Number(options["timeout-ms"] ?? DEFAULT_PAUSE_TIMEOUT_MS);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 0 || timeoutMs > 300_000) throw new Error("Invalid pause timeout.");
  const context = createContext(overrides);
  const requestedAt = nowIso();
  await writeSentinel(context, runtimeFiles.pause, { schemaVersion: "1.0.0", requestedAt, requestedByPid: process.pid });
  if (options.stop === true) {
    await writeSentinel(context, runtimeFiles.stop, { schemaVersion: "1.0.0", requestedAt, requestedByPid: process.pid });
  }
  const state = await readJson(context, runtimeFiles.state, { optional: true }).catch(() => null);
  await writeRunState(context, { runId: state?.runId, status: "pausing", pauseRequestedAt: requestedAt, nextAction: state?.nextAction });
  const deadline = Date.now() + timeoutMs;
  let operation = await readJson(context, runtimeFiles.operation, { optional: true }).catch((error) => ({ error: error.message }));
  while (operation?.active === true && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(250, Math.max(1, deadline - Date.now()))));
    operation = await readJson(context, runtimeFiles.operation, { optional: true }).catch((error) => ({ error: error.message }));
  }
  const terminatedProcesses = await terminateDisposableProcesses(context, "pause-timeout-or-request");
  const saved = await saveOperation(context, {
    ...(operation ?? {}), active: false, pausedAt: nowIso(), nextAction: operation?.nextAction ?? state?.nextAction ?? "Run pnpm.cmd autonomy:doctor, then pnpm.cmd autonomy:resume.",
  });
  await writeRunState(context, { runId: state?.runId, status: "paused", pausedAt: nowIso(), nextAction: saved.nextAction });
  await writeResumePacket(context, {
    state: "paused", runId: state?.runId, nextAction: saved.nextAction, operation: saved,
    notes: `Pause completed. ${terminatedProcesses.filter((item) => item.terminated).length} registered disposable process tree(s) terminated; logs were preserved.`,
  });
  return { safelyPaused: true, repeated: state?.status === "paused", operation: saved, terminatedProcesses };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  pauseRuntime().then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => {
    console.error(`${error.code ?? error.name}: ${error.message}`);
    process.exitCode = 1;
  });
}
