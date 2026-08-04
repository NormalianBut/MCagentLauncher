# Autonomy Lab Interruption And Recovery

The Autonomy Lab treats interruption as expected. Runtime state lives outside Git; work-package state lives on a `codex/*` branch; only reviewed and verified commits may enter the protected integration baseline. These controls are repository tooling and do not grant the Desktop product process, Java, Minecraft, download, or existing-instance authority.

## Configure The Control Directory

Set `MCAGENT_AUTONOMY_CONTROL_DIR` to a dedicated directory outside every Git worktree. On Windows, the default is `%LOCALAPPDATA%\MCagentlauncher\autonomy-lab`. Administrator rights are neither requested nor required. The tools reject a filesystem root and any directory inside the active repository.

The directory contains `run-state.json`, `lease.json`, `process-registry.json`, `current-operation.json`, `last-heartbeat.json`, `PAUSE`, `STOP`, preserved `logs/`, and recovery `evidence/`. JSON publications use same-directory temporary files and rename. Corrupt or ambiguous state fails closed.

## Normal Commands

```powershell
pnpm.cmd autonomy:status
pnpm.cmd autonomy:pause
pnpm.cmd autonomy:doctor
pnpm.cmd autonomy:resume
pnpm.cmd autonomy:cleanup
```

`autonomy:pause` sets `PAUSE` first. New work then fails its preflight check. A bounded active unit may finish until the configured timeout; registered disposable processes are challenged through their per-process ownership endpoint and terminated when required. Logs, operation state, Git work, branches, and worktrees remain. Repeating pause is safe.

`autonomy:resume` inspects the previous lease, registered processes, Git branch/status/worktrees, runtime publications, and durable operation. It preserves timestamped evidence before changing recovery state. It never resets Git, deletes uncommitted work, discards a branch, or executes the recorded next action as a command. A new coordinator reads the exact action and starts a bounded unit deliberately.

`autonomy:cleanup` is conservative and idempotent. It refuses active/corrupt leases and live registered processes, preserves logs/evidence, prunes completed registry entries, and removes only exact Autonomy Lab temporary-publication names directly inside the configured control directory. It never removes a worktree or branch.

## Lease And Heartbeat

Only one coordinator may acquire the control-directory lease. It records run ID, host/platform/executable/PID identity, branch, worktree, objective, creation time, last heartbeat, and expiry. A coordinator must heartbeat every 15 seconds; leases expire after 45 seconds. A stale lease requires doctor/resume inspection and is not permission to delete work or kill a PID.

PID is never sufficient ownership evidence. Each supervised wrapper owns an unpredictable local named-pipe/socket endpoint. Pause, resume, and cleanup verify the live wrapper by matching PID and nonce challenge. An unavailable or mismatched endpoint fails closed and the process is not terminated.

## Bounded Work And Checkpoints

Before a new task, privileged tooling operation, download (none exists), build, or long process, call the pause/STOP preflight. Call it again after each bounded unit. A work package should checkpoint at least every 20-30 minutes:

1. Update `current-operation.json` with the exact next action.
2. Update `docs/execution/resume-packet.md` and the progress log.
3. Commit a small coherent WIP checkpoint on the `codex/*` branch when useful.
4. Keep failed/incomplete work isolated until focused verification passes.

No irreversible operation may rely on a future model turn for cleanup. The local supervisor owns timeouts and cleanup, while transaction code must own partial writes. Completed work is not rerun unless recovery verification invalidates its evidence.

## Process Supervision

Long-running Autonomy Lab commands use `scripts/autonomy-process-supervisor.mjs`. It uses direct argument-vector spawning, not a shell; requires a bounded timeout; restricts the working directory to the active worktree; rejects Java executables; records purpose, working directory, executable identity, expected child, logs, timeout, and cleanup policy; and preserves exit evidence. Windows tree termination uses a verified wrapper request first and `taskkill /T /F` only as a verified fallback. Tests use harmless Node children.

No unregistered detached process is permitted. Short synchronous Git/OS inspection commands are bounded diagnostics, not detached workers. Never use this layer to launch Java, Minecraft, a launcher, a downloader, or a product sidecar.

## Resource Modes

- `USER_ACTIVE`: one coordinator, focused tests and lightweight builds only; no packaging build, large download, or Minecraft launch.
- `MACHINE_IDLE`: configured concurrency and full verification may run, still with leases, timeouts, and resource limits.

Windows idle state is not inferred from privileged system inspection. The safe default is `USER_ACTIVE`. `MACHINE_IDLE` requires `MCAGENT_AUTONOMY_MACHINE_IDLE=1` and at least 20% free memory; uncertainty falls back to `USER_ACTIVE`. The tools do not change Windows power settings.

## Emergency Stop

```powershell
pnpm.cmd autonomy:pause -- --stop
pnpm.cmd autonomy:status
pnpm.cmd autonomy:doctor
```

`STOP` persists across app closure and reboot. Recovery does not clear it implicitly. After inspecting the cause and confirming that registered processes, Git work, and transactions are safe, run `pnpm.cmd autonomy:resume -- --clear-stop`.

If Node/pnpm is unavailable, create an empty `STOP` file in the configured control directory. This blocks the next checked unit but cannot act while the machine is powered off. Do not manually kill guessed PIDs or delete the control directory.

## What Survives

- Usage exhaustion or a replacement thread: runtime JSON, Git commits/status, logs, evidence, and `resume-packet.md` remain readable without the old conversation or model.
- App closure, crash, sleep, reboot, or power loss: published checkpoints remain. In-memory work and a write that never reached atomic publication do not; doctor detects missing/corrupt state and temporary publications.
- Network loss: local checkpoints and focused offline verification remain; network work cannot continue.
- Machine off: nothing executes. Recovery begins after restart; no heartbeat is expected while off.

## Migration And Limitations

To move to a dedicated machine or remote environment, push the isolated branch, copy only reviewed non-secret evidence if needed, configure a new control directory outside its worktree, run doctor, and start a new lease. Do not copy a live lease as authority or migrate machine-specific PIDs/endpoints.

This bootstrap does not automatically detect Windows interactive idle time, resume a model conversation, execute the next action, discover worktrees outside Git's list, inspect existing Minecraft data, or recover Desktop transactions not explicitly recorded by a future adapter. It preserves ambiguity for human review. No download, Java, Minecraft, authentication, product sidecar, administrator, or automatic-spending capability is present.
