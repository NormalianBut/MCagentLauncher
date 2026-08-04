# Active Plan: M18 Autonomy Lab Interruption Recovery

## Objective

Implement interruption-resilient repository tooling that persists control state outside Git, checkpoints exact work-package progress on a Codex branch, and recovers conservatively without expanding Desktop product authority beyond merged M17.

## Verifiable Stopping Condition

The five package commands, single-coordinator lease, heartbeat contract, PAUSE/STOP protocol, recovery doctor, conservative cleanup, resource-mode decision, and ownership-verifying bounded process supervisor pass the interruption matrix and full project verification; documentation/state are current; the branch is pushed and a verified Draft PR targets `main` without merge.

## Current Baseline

- Branch: `codex/m18-autonomy-recovery`, created from clean synchronized `main`.
- Baseline: `884403e66d84498d64263ec48c663efee50bb278` (merged M17, tag `v0.2-beta-m17`).
- Enabled product capabilities remain exactly the merged M17 controlled-workspace simulation.
- The user explicitly approved this M18 repository-tooling process/filesystem scope on 2026-08-04; Desktop process execution remains unapproved.

## Scope

- `scripts/autonomy-*.mjs`, package commands, and harmless-process tests.
- External control directory, atomic JSON, sentinels, lease/heartbeat, durable operation/resume packet.
- Direct no-shell wrapper, bounded timeout, logs, nonce challenge, and verified tree cleanup.
- Git inspection, conservative recovery/cleanup, USER_ACTIVE-safe resource mode, and governance documentation.

## Non-goals

Desktop/Tauri process authority, Java/Minecraft/launcher execution, downloads, network work, authentication, existing Minecraft/user-directory access, product sidecars, power-setting changes, auto-spending, automatic model continuation, merge, tag, or Release.

## Architecture Impact

This adds a repository operations layer around development only. It is not part of the Planner or Desktop Execution Plane and cannot be called from product surfaces. The protected integration baseline still receives changes only through review.

## Security Impact

Classification is GATED because tooling writes external state and supervises processes. The request grants only this branch/work-package scope. Exact file allowlists, out-of-worktree containment, in-worktree child working directories, direct spawning, Java rejection, bounded timeouts, PID-plus-nonce ownership, fail-closed cleanup, and evidence preservation constrain it.

## Implementation Checkpoints

1. **Completed - baseline and gate:** reconciled merged M17, created the branch, and recorded the tooling-only boundary.
2. **Completed - runtime foundation:** implemented checkpoint files, lease/heartbeat, sentinels, commands, recovery, supervisor, and resource modes.
3. **Completed - focused tests:** the initial Windows CIM identity approach failed safely; replaced it with a no-admin named-pipe challenge. All 15 focused tests pass.
4. **Completed - documentation and audit:** synchronized policy/state/risk/resume documentation and hardened supervision to require an active matching lease.
5. **Completed - full project verification:** unified verification passed all configured suites, builds, Desktop security, boundary scan, and whitespace check.
6. **In progress - review handoff:** targeted scans and repeated unified verification passed; commit, synchronize/push, and open a Draft PR targeting `main`; do not merge.

## Tests

- `pnpm.cmd test:autonomy-runtime`
- `pnpm.cmd verify:project`
- `pnpm.cmd check:autonomy-boundaries`
- `git diff --check`
- targeted secret, TODO/FIXME, dependency, platform-boundary, Java/Minecraft/download scans.

## Boundary Scan

Only exact Autonomy Lab tooling files may use Node filesystem/process APIs. Fail on product process authority, shell spawning, network/download clients, Java/Minecraft probes, authentication/secrets, arbitrary child working directories, new production dependencies, or a platform-boundary diff.

## Rollback

Revert or abandon only this feature branch. Runtime cleanup may remove exact control-directory temporary publications after inspection; it preserves logs and never deletes Git worktrees, branches, or uncommitted changes. A stale lease is evidence, not cleanup authority.

## Approval Gates

DQ-008 approves only this repository-tooling checkpoint. DQ-003 through DQ-006 and all Desktop network, Java, OAuth, process, sidecar, Minecraft-directory, real-installation, merge, tag, and release gates remain closed.

## Progress Log Requirements

Append actual commands/results after each checkpoint; keep this plan, project state, risk register, and resume packet synchronized. Always record one exact next action.

## Completion Report

Report branch/PR, pause/resume/lease/checkpoint/supervisor behavior, recovery evidence, exact tests, limitations, and user pause/resume commands. Do not claim product execution capability.
