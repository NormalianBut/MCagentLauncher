import {
  acquireLease,
  assertMayStartWork,
  clearOperation,
  createContext,
  heartbeat,
  inspectGit,
  parseArguments,
  removeLeaseIfOwned,
  runtimeSnapshot,
  saveOperation,
  writeResumePacket,
  writeRunState,
} from "./autonomy-runtime.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function runController(argv = process.argv.slice(2), overrides = {}) {
  const { options, positionals } = parseArguments(argv);
  const command = positionals[0];
  const context = createContext(overrides);
  if (command === "start") {
    const objective = options.objective;
    const nextAction = options["next-action"];
    if (!objective || !nextAction) throw new Error("start requires --objective and --next-action");
    const git = inspectGit(context.repositoryRoot);
    if (!git.branch.startsWith("codex/")) throw new Error("Coordinator work requires a codex/* feature branch.");
    const lease = await acquireLease(context, { objective, branch: git.branch, worktree: context.repositoryRoot });
    await saveOperation(context, { runId: lease.runId, phase: "ready", objective, nextAction, bounded: true });
    await writeRunState(context, { runId: lease.runId, status: "running", resourceMode: "USER_ACTIVE", nextAction });
    await writeResumePacket(context, { state: "running", runId: lease.runId, nextAction, git });
    return { lease, nextAction };
  }
  if (command === "heartbeat") {
    if (!options["run-id"]) throw new Error("heartbeat requires --run-id");
    return heartbeat(context, options["run-id"]);
  }
  if (command === "checkpoint") {
    if (!options["run-id"] || !options["next-action"]) throw new Error("checkpoint requires --run-id and --next-action");
    await assertMayStartWork(context, "checkpoint continuation");
    const operation = await saveOperation(context, {
      runId: options["run-id"], phase: options.phase ?? "checkpointed", nextAction: options["next-action"], bounded: true,
    });
    await writeRunState(context, { runId: options["run-id"], status: "running", nextAction: options["next-action"] });
    await writeResumePacket(context, { state: "running", runId: options["run-id"], nextAction: options["next-action"], operation });
    return operation;
  }
  if (command === "complete") {
    if (!options["run-id"]) throw new Error("complete requires --run-id");
    await clearOperation(context);
    await writeRunState(context, { runId: options["run-id"], status: "completed", nextAction: "No pending action." });
    await removeLeaseIfOwned(context, options["run-id"]);
    await writeResumePacket(context, { state: "completed", runId: options["run-id"], nextAction: "No pending action." });
    return { completed: true, runId: options["run-id"] };
  }
  if (command === "snapshot") return runtimeSnapshot(context);
  throw new Error("Usage: autonomy-controller.mjs <start|heartbeat|checkpoint|complete|snapshot> [options]");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runController().then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => {
    console.error(`${error.code ?? error.name}: ${error.message}`);
    process.exitCode = 1;
  });
}
