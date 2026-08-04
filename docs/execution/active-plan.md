# Active Plan: M17 Controlled Workspace And Transaction Foundation

## Objective

Implement the first approved Desktop Execution Plane vertical slice: an application-managed test workspace with canonical containment, versioned manifest and journal persistence, explicit confirmation, and simulated commit, interruption, recovery, and rollback.

## Verifiable Stopping Condition

M17 is complete when the Desktop-owned Rust adapter can preview without writing, requires an exact confirmation before creating an isolated workspace, persists deterministic versioned records, recovers idempotently after simulated interruption, and removes only test artifacts recorded as owned by the current transaction. Adversarial containment and recovery tests, project verification, the autonomy boundary scan, and `git diff --check` must pass.

## Current Baseline

- Branch: `codex/m17-controlled-workspace`, created from synchronized `main`.
- Baseline commit: `a360361` (`Merge pull request #11 from NormalianBut/codex/m16-local-executor-architecture`).
- Release checkpoint: `v0.2-beta-m16`; package version remains `0.1.0`.
- Worktree was clean before branch creation.
- DQ-001, DQ-002, and DQ-007 were explicitly approved on 2026-08-04 for this restricted package.
- Network, downloads, Java, OAuth, process execution, user-selected paths, existing Minecraft directories, real instance mutation, updater, sidecar, telemetry, and commercial model integration remain disabled.

## Scope

- Desktop-owned Rust code under `apps/desktop/src-tauri` only.
- A fixed child root beneath Tauri's application data directory and opaque, validated workspace/transaction identities.
- Canonical containment checks before every read, write, rename, or removal.
- Symlink, Windows junction, and reparse-point rejection.
- Immutable, versioned manifest and per-event transaction journal JSON.
- Atomic temporary-file publication and synchronized file contents where supported by the standard library.
- Deterministic transaction state derivation and idempotent recovery.
- Fixed-name test artifacts owned and recorded by one transaction.
- Dry-run preview and a separate digest confirmation bound to the exact workspace, transaction, strict simulation operation, fixed target class, schema/policy revisions, and test-only purpose before mutation.

## Non-goals

- Any access to `.minecraft`, third-party launcher instances, user-selected directories, or unrelated user files.
- Download, artifact installation, Minecraft/loader/mod/resource-pack/shader installation, Java discovery/execution, shell/process execution, OAuth, launch, updater, sidecar, telemetry, or model integration.
- Accepting an absolute path, relative path, filename, command, URL, or environment data from a caller.
- Adding a production dependency.
- Declaring a playable instance or changing `docs/platform-boundaries.md`.

## Architecture Impact

This is the first narrowly privileged implementation in the Desktop Execution Plane. Planner packages remain unable to perform I/O. The adapter resolves only a fixed executor-owned child of the Desktop application-data directory. Its persisted manifest describes the workspace-foundation simulation, not Minecraft installation state.

## Security Impact

- Classification: GATED, explicitly approved only for DQ-001, DQ-002, and DQ-007 restrictions recorded in the decision queue.
- New authority: create, inspect, atomically update, and remove transaction-owned test data inside the fixed controlled root.
- Path defense: restricted identifiers, lexical containment, canonical existing-ancestor checks, and symlink/reparse rejection before every operation.
- Rollback uses only the immutable owned-artifact record for the same transaction; it does not discover deletion targets from directory contents.
- Persistence excludes secrets, tokens, telemetry, environment dumps, URLs, commands, and absolute paths.

## Implementation Checkpoints

1. **Completed - approval and baseline:** confirmed clean merged M16 baseline, created the scoped branch, and recorded the exact gate boundary.
2. **Completed - controlled workspace adapter:** implemented containment, persistence, confirmation, and the simulation lifecycle with no new dependency.
3. **Completed - adversarial tests:** covered absolute/mixed-separator/traversal identifier rejection, existing-owner-marker enforcement, reparse metadata, conditional Windows directory-symlink rejection, cross-operation/workspace/transaction confirmation rejection, uniqueness, dry-run no-write behavior, interruption, corrupt manifest, gapped journal, unknown-artifact refusal, unwind-safe temp cleanup, idempotency, and transaction-scoped rollback.
4. **Completed - full verification and audit:** Rust format/clippy/tests, Desktop security/build, unified project verification, boundary scan, diff checks, and manual prohibited-capability review passed.
5. **Completed - durable handoff:** synchronized project state, decisions, risks, architecture/security/public docs, and recorded actual outcomes in the progress log.

## Tests

- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
- `pnpm.cmd --dir apps/desktop check:security`
- `pnpm.cmd --dir apps/desktop build`
- `pnpm.cmd check:autonomy-boundaries`
- `pnpm.cmd verify:project`
- `git diff --check`

## Boundary Scan

- Permit filesystem mutation only in the reviewed Desktop controlled-workspace module.
- Reject any network client, URL fetch, process/shell API, Java/Minecraft path probe, OAuth/token handling, updater, sidecar, arbitrary path parameter, environment enumeration, or new production dependency.
- Confirm Tauri capabilities expose no filesystem plugin and only explicitly registered narrow commands.
- Confirm `docs/platform-boundaries.md` is unchanged.

## Rollback

Repository rollback is removal or revert of this scoped branch. Runtime rollback removes only fixed-name simulation artifacts listed in the current transaction's owned-artifact record after revalidating containment and transaction identity. It never removes the workspace root, sibling transactions, pre-existing data, or discovered files.

## Approval Gates

- `GATE-EXEC-01` and the minimum `GATE-FS-01` scope are approved only for this plan through DQ-001, DQ-002, and DQ-007.
- `GATE-USER-PATH-01`, `GATE-NET-01`, `GATE-JAVA-01`, `GATE-OAUTH-01`, `GATE-PROC-01`, `GATE-DEP-01`, `GATE-UPDATER-01`, `GATE-SIDECAR-01`, `GATE-MC-DIR-01`, and `GATE-REL-01` remain unapproved.
- Stop before any production dependency, user-selected location, existing Minecraft access, real installation, download, process, Java, authentication, launch, or release action.

## Progress Log Requirements

After each checkpoint, update this plan and `docs/project-state.md`, then append commands, actual results, regressions, next action, and decision status to `docs/execution/progress-log.md`. Update the decision queue and risk register when evidence changes.

## Completion Report

Report changed files, exact filesystem authority introduced, containment/atomicity/recovery evidence, tests and actual outcomes, remaining limitations and gates, and the branch state. Do not claim a playable instance, installation capability, or approval beyond this workspace foundation.

M17 reached its stopping condition on 2026-08-04. Feature commit `c9a59f89d858ccf1ad52e41f8021c52e8198dd9d` is pushed on `codex/m17-controlled-workspace`, and Draft PR #12 targets `main` without merge. Full project verification passed with 14 schema examples, 84 shared-types tests, 90 API-client tests, Web/Desktop builds, 9 controlled-workspace Rust tests, the Desktop security allowlist, 26 server tests, and zero autonomy-scan violations. Final review bound confirmation to the exact operation and target, made rollback refuse unknown artifacts, added unwind-safe test cleanup, and repeated containment checks around filesystem operations. No dependency, platform-boundary, network, process, Java, OAuth, Minecraft-directory, real-installation, or release change was introduced.
