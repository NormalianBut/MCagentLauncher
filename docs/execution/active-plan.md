# Active Plan: M16 Local Executor Architecture Design

## Objective

Define the future Desktop Local Executor architecture and side-effect-free contracts without implementing or enabling runtime capability.

## Verifiable Stopping Condition

M16 is complete when an accepted-for-review ADR and deterministic contracts define ownership, Resource Plan handoff, controlled workspace choices, permission and confirmation binding, transaction and manifest invariants, failures, audit, rollback, recovery, and every later approval gate; all project verification passes; and no runtime privilege is added.

## Current Baseline

- Branch: `codex/m16-local-executor-architecture`, created from synchronized `main`.
- Commit: `6e277a6` (`Merge pull request #10 from NormalianBut/chore/autonomous-development-governance`).
- Release checkpoint: `v0.2-beta-m15`; package version remains `0.1.0`.
- Worktree was clean before branch creation.
- Desktop remains preview-only. No filesystem write, download, Java, authentication, process, instance-mutation, updater, sidecar, or launch authority is enabled.
- The governance baseline was last verified on 2026-08-04; M16 verification is pending.

## Scope

- ADR and architecture/security documentation for the future Execution Plane.
- Pure, serializable contracts for reviewed-plan handoff, workspace ownership, capability permissions, confirmation, manifests, transactions, failures, rollback/recovery, and audit events.
- Deterministic validation, normalization, and state-transition helpers that have no I/O handles.
- Tests proving contract invariants and the disabled runtime boundary.
- Durable state, decision, risk, and progress updates.

## Non-goals

- Filesystem reads or writes, path discovery, path selection UI, instance creation, manifest persistence, or lockfile persistence.
- Artifact, loader, Java, or game downloads.
- Java discovery, provisioning, selection, or execution.
- Authentication, Microsoft OAuth, credentials, tokens, or secure storage.
- Shell, child-process, sidecar, launcher, updater, or Minecraft execution.
- Production dependency additions, merge, tag, Release, or `docs/platform-boundaries.md` changes.

## Architecture Impact

- Planner Plane remains authoritative for deterministic, compatibility-aware `ResourcePlan` data and cannot execute it.
- Desktop remains the sole future owner of execution, but M16 exposes no runtime implementation handle.
- The handoff must bind an immutable reviewed-plan snapshot and compatibility disposition to a distinct future execution request.
- Application-managed workspaces and user-selected locations share policy contracts but remain distinct trust classes.
- ADR 0008 is required because M16 establishes the future Execution Plane's transaction and authority boundary.

## Security Impact

- Classification: AUTO design and pure contracts only.
- All plan, workspace, confirmation, manifest, and recovery data is untrusted until independently validated by a future gated implementation.
- Permissions are deny-by-default and bound to exact capability identifiers, request identity, reviewed-plan digest, manifest digest, workspace identity, and confirmation revision.
- M16 cannot prove path containment, atomicity, hash verification, secure storage, or process cleanup; those require later platform-specific evidence and gates.

## Implementation Checkpoints

1. **Completed - governance and architecture baseline:** required documents, ADRs, existing preview contracts, Git state, and boundaries inspected; scoped branch created.
2. **Completed - ADR and durable design:** ADR 0008 defines ownership, trust boundaries, reviewed-plan handoff, workspace classes, state machines, failure semantics, and gates.
3. **Completed - pure contracts and tests:** shared contracts and deterministic validators cover requests, permissions, confirmation, manifests, transactions, failures, rollback/recovery, and audit without I/O; 84 shared-types tests pass and the contract module type-checks in isolation.
4. **Completed - documentation and state audit:** architecture, security, executor design, public roadmap, decisions, risks, project state, and progress are synchronized; manual boundary scans found no runtime imports, secret signature, or platform-boundary diff.
5. **Completed - full verification:** `pnpm.cmd verify:project`, the explicit autonomy scan, isolated contract type-check, `git diff --check`, and manual diff/boundary review pass with no runtime privilege added.
6. **Completed - review handoff:** committed and pushed `938f5f7`; draft PR #11 targets `main` and remains unmerged; DQ-001, DQ-002, and DQ-007 are awaiting user action before runtime work.

## Tests

- `pnpm.cmd test:shared-types`: all existing and M16 contract tests pass.
- `pnpm.cmd validate:schemas`: all schema examples remain valid.
- `pnpm.cmd verify:project`: schemas, shared types, API client, Web/Desktop builds, server tests, autonomy boundary scan, and verifier whitespace check pass.
- `pnpm.cmd check:autonomy-boundaries`: zero clear runtime privilege violations.
- `git diff --check`: no whitespace errors.
- Manual diff inspection: no runtime I/O handle, production dependency, secret, unauthorized platform-boundary change, or weakened safety check.

Verification on 2026-08-04 passed 14 schema examples, 84 shared-types tests, 90 API-client tests, Web and Desktop builds, 26 server tests, and a 197-file autonomy scan with zero violations. Existing Starlette/httpx deprecation and denied pytest cache creation warnings remain non-passing warnings.

## Boundary Scan

- Inspect imports and manifests for filesystem mutation, downloader, child-process, shell, Java, OAuth, Tauri privileged plugins, updater, sidecar, or commercial model APIs.
- Confirm contracts contain data only and no callbacks, clients, file descriptors, command builders, executable paths, access tokens, or ambient environment access.
- Confirm `docs/platform-boundaries.md` is unchanged.
- Confirm every future privileged capability is named in the ADR, decision queue, and approval-gate matrix.

## Rollback

Abandon or revert only the scoped Git branch. M16 writes no user or instance data and therefore requires no runtime cleanup. A future implementation may not reuse this Git-only rollback claim as runtime rollback evidence.

## Approval Gates

- M16 architecture, threat model, and pure contracts: AUTO.
- `GATE-EXEC-01`: stop before the first privileged Local Executor adapter or dispatcher.
- `GATE-FS-01`: stop before filesystem access, workspace creation, manifest/journal persistence, or instance mutation.
- `GATE-USER-PATH-01`: stop before resolving or using a user-selected location.
- `GATE-NET-01`: stop before artifact, loader, Java, or game download behavior.
- `GATE-JAVA-01`: stop before Java discovery, selection, provisioning, or execution.
- `GATE-OAUTH-01`: stop before OAuth, credentials, token handling, or secure storage.
- `GATE-PROC-01`: stop before shell, child-process, sidecar, launcher, or Minecraft execution.
- `GATE-DEP-01`: stop before a production dependency or material privilege-expanding upgrade.
- `GATE-UPDATER-01`, `GATE-SIDECAR-01`, and `GATE-MC-DIR-01`: stop before these out-of-scope capabilities are introduced.
- `GATE-REL-01`: stop before a First Playable release, merge, tag, or Release action.
- Production dependencies and `docs/platform-boundaries.md` changes require separate explicit approval.

## Progress Log Requirements

After each checkpoint, update this plan and `docs/project-state.md`, then append commands, actual results, regressions, next action, and decision status to `docs/execution/progress-log.md`. Update the decision queue and risk register whenever design evidence changes a future gate.

## Completion Report

Report only completed work packages, branch/PR status, verification results, current project state, outstanding risks, decision entries requiring user action, and the exact stopping reason. Do not claim M16 enables execution or approves any later gate.

M16 reached its stopping condition on 2026-08-04. The architecture package is fully verified and available in draft PR #11. Work stops before the first privileged Local Executor adapter at `GATE-EXEC-01` and before filesystem scope at `GATE-FS-01`.
