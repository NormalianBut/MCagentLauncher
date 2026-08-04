import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createContext, isContained, isOwnedTemporaryPublication, leaseIsStale, preserveEvidence, readJson, runtimeFiles, writeRegistry,
} from "./autonomy-runtime.mjs";
import { inspectRegisteredProcesses } from "./autonomy-process-supervisor.mjs";

export async function cleanupRuntime(overrides = {}) {
  const context = createContext(overrides);
  const lease = await readJson(context, runtimeFiles.lease, { optional: true }).catch((error) => ({ error: error.message }));
  if (lease && !lease.error && !leaseIsStale(lease)) throw new Error("Refusing cleanup while a lease is active.");
  if (lease?.error) throw new Error("Refusing cleanup while lease state is corrupt.");
  const inspections = await inspectRegisteredProcesses(context);
  const live = inspections.filter((item) => item.identity.alive);
  if (live.length > 0) throw new Error("Refusing cleanup while registered processes are alive; pause or resume recovery first.");
  const evidence = await preserveEvidence(context, "pre-cleanup", { lease, processInspections: inspections });
  const removed = [];
  let entries = [];
  try {
    entries = await readdir(context.controlDirectory, { withFileTypes: true });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  for (const entry of entries) {
    if (!entry.isFile() || !isOwnedTemporaryPublication(entry.name)) continue;
    const target = path.join(context.controlDirectory, entry.name);
    if (!isContained(context.controlDirectory, target)) throw new Error("Cleanup target escaped the control directory.");
    await rm(target);
    removed.push(target);
  }
  const registry = await readJson(context, runtimeFiles.processes, { optional: true }).catch(() => null);
  if (registry) await writeRegistry(context, registry.processes.filter((entry) => entry.status === "running"));
  return { cleaned: true, evidence, removed, logsPreserved: true, branchesPreserved: true, idempotent: true };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cleanupRuntime().then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => {
    console.error(`${error.code ?? error.name}: ${error.message}`);
    process.exitCode = 1;
  });
}
