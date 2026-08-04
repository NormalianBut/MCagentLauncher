import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  controlPath, createContext, detectResourceMode, fileMetadata, inspectGit, leaseIsStale,
  isOwnedTemporaryPublication, runtimeFiles, runtimeSnapshot,
} from "./autonomy-runtime.mjs";
import { inspectRegisteredProcesses } from "./autonomy-process-supervisor.mjs";

async function listTemporaryPublications(context) {
  try {
    const entries = await readdir(context.controlDirectory, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && isOwnedTemporaryPublication(entry.name)).map((entry) => path.join(context.controlDirectory, entry.name)).sort();
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

export async function diagnoseRuntime(overrides = {}) {
  const context = createContext(overrides);
  const snapshot = await runtimeSnapshot(context);
  const processInspections = await inspectRegisteredProcesses(context).catch((error) => [{ error: error.message }]);
  const temporaryPublications = await listTemporaryPublications(context);
  const issues = [];
  if (!snapshot.state) issues.push({ code: "MISSING_RUN_STATE", severity: "warning", action: "Start or resume from the durable packet." });
  if (snapshot.state?.error) issues.push({ code: "CORRUPT_RUN_STATE", severity: "error", action: "Preserve evidence and reconstruct state from Git and resume-packet.md." });
  if (snapshot.state && !snapshot.state.error && (snapshot.state.schemaVersion !== "1.0.0" || typeof snapshot.state.status !== "string")) {
    issues.push({ code: "CORRUPT_RUN_STATE", severity: "error", action: "Run state has an unsupported shape; preserve it for recovery." });
  }
  if (snapshot.lease && !snapshot.lease.error && leaseIsStale(snapshot.lease)) issues.push({ code: "STALE_LEASE", severity: "warning", action: "Run autonomy:resume; do not delete work." });
  if (snapshot.lease?.error) issues.push({ code: "CORRUPT_LEASE", severity: "error", action: "Preserve evidence before manual recovery." });
  if (processInspections[0]?.error) issues.push({ code: "CORRUPT_PROCESS_REGISTRY", severity: "error", action: "Preserve the registry and do not terminate guessed PIDs." });
  for (const inspection of processInspections) {
    if (inspection.identity?.alive && !inspection.identity.owned) {
      issues.push({ code: "PROCESS_IDENTITY_MISMATCH", severity: "error", pid: inspection.entry.pid, action: "Do not terminate this PID automatically." });
    } else if (inspection.identity?.alive && inspection.entry.status !== "running") {
      issues.push({ code: "ORPHANED_REGISTERED_PROCESS", severity: "warning", pid: inspection.entry.pid, action: "Resume may terminate it only after ownership verification." });
    }
  }
  if (temporaryPublications.length > 0) issues.push({ code: "INCOMPLETE_PUBLICATIONS", severity: "warning", count: temporaryPublications.length, action: "Inspect, then run cleanup while paused." });
  return {
    schemaVersion: "1.0.0",
    healthy: !issues.some((issue) => issue.severity === "error"),
    resourceMode: detectResourceMode(),
    git: inspectGit(context.repositoryRoot),
    snapshot,
    processInspections,
    temporaryPublications,
    resumePacket: await fileMetadata(path.join(context.repositoryRoot, "docs", "execution", "resume-packet.md")),
    runtimeFiles: Object.fromEntries(await Promise.all(Object.entries(runtimeFiles).map(async ([name, filename]) => [name, await fileMetadata(controlPath(context, filename))]))),
    issues,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  diagnoseRuntime().then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => {
    console.error(`${error.code ?? error.name}: ${error.message}`);
    process.exitCode = 1;
  });
}
