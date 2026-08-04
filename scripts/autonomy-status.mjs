import path from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, leaseIsStale, runtimeSnapshot } from "./autonomy-runtime.mjs";
import { inspectRegisteredProcesses } from "./autonomy-process-supervisor.mjs";

export async function statusRuntime(overrides = {}) {
  const context = createContext(overrides);
  const snapshot = await runtimeSnapshot(context);
  const processes = await inspectRegisteredProcesses(context).catch((error) => [{ error: error.message }]);
  return {
    ...snapshot,
    leaseStatus: !snapshot.lease ? "missing" : snapshot.lease.error ? "corrupt" : leaseIsStale(snapshot.lease) ? "stale" : "active",
    processes,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  statusRuntime().then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => {
    console.error(`${error.code ?? error.name}: ${error.message}`);
    process.exitCode = 1;
  });
}
