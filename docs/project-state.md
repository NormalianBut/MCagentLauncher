# Project State

This is the primary handoff document for a new Codex session. Read it before the roadmap or active implementation files, then verify its claims against Git and the worktree.

## Release And Baseline

- Package version: `0.1.0`.
- Current release checkpoint: `v0.2-beta-m16`.
- Baseline branch: `main`, tracking `origin/main`.
- Baseline commit: `a360361` (`Merge pull request #11 from NormalianBut/codex/m16-local-executor-architecture`).
- Active branch: `codex/m17-controlled-workspace`, created from the clean synchronized baseline.
- M17 feature commit: `c9a59f89d858ccf1ad52e41f8021c52e8198dd9d` (`feat: add controlled workspace transaction foundation`).
- Draft review: GitHub PR #12 targets `main`; it is not merged.

Always run `git status --short --branch` and `git log -1 --oneline --decorate` before relying on this baseline.

## Completed Milestones

- M0-M10: monorepo, schemas, mock planning API, Resolver foundations, Web/Desktop previews, safe probe policy, alpha release preparation.
- M11: runtime topology and endpoint capability negotiation.
- M12: unsigned Windows-first Native Desktop Packaging Preview.
- M13: provider-neutral Resource Resolver architecture.
- M14: Modrinth metadata provider under explicit metadata-only policy.
- M15: deterministic Compatibility Analysis Engine and plan diagnostics.
- M16: Local Executor architecture, threat model, approval gates, and pure contracts.

## Enabled Capabilities

- Existing Planner, metadata, compatibility, Web/API, Desktop preview, and safe-platform-probe capabilities.
- M17 Desktop-only dry-run preview for an opaque application-managed workspace and transaction identity.
- After exact confirmation, creation of a fixed controlled root beneath Tauri's application data directory.
- Versioned simulation-only manifest and checksum-chained journal persistence.
- Simulated commit, interruption, deterministic recovery, and current-transaction test-artifact rollback.

## Disabled Capabilities

- Existing `.minecraft`, third-party launcher instance, user-selected directory, arbitrary-path, unrelated-file, or real user-instance access.
- Resource, loader, Java, or Minecraft downloads and installation.
- Shell, child process, sidecar, Java, launcher, or Minecraft execution.
- Java discovery and Minecraft directory scanning.
- OAuth, Microsoft authentication, token persistence, updater, telemetry, environment upload, commercial model APIs, and production dependency additions.
- Live Resolver use by the Python MCAgent Server (`liveResourceResolver=false`).

## Current Objective

M17 Controlled Workspace And Transaction Foundation has reached its implementation, verification, and review-handoff stopping condition on its scoped feature branch. Feature commit `c9a59f89d858ccf1ad52e41f8021c52e8198dd9d` is pushed and Draft PR #12 awaits review. DQ-001, DQ-002, and DQ-007 approve only this minimum filesystem gate; every later gate remains unapproved.

## Next Unblocked Task

Review the M17 branch and decide the next separately scoped work package. Stop before any real installation, download, Java, authentication, process, user-selected-path, Minecraft-directory, dependency, updater, sidecar, or release capability.

## Open Decisions

The authoritative queue is `docs/execution/decision-queue.md`. DQ-003 through DQ-006 remain open for download trust, Java ownership, authentication/token storage, and process lifecycle. DQ-001, DQ-002, and DQ-007 are decided only for M17's restricted scope.

## Known Limitations

- M17 creates only a synthetic test marker; it cannot create, install, or launch a Minecraft instance.
- The confirmation digest is bound to schema/policy, fixed target class, opaque workspace and transaction identities, strict simulation operation, and test-only purpose; exclusive transaction creation prevents replay. It is not an authentication credential, signature, or approval for later capabilities.
- Atomicity uses synchronized temporary files followed by same-directory rename. Directory-entry synchronization and hostile concurrent path substitution are limited by Rust standard-library platform APIs and remain review concerns before broader mutation.
- Recovery understands only the simulation state machine and fixed owned artifact. Unknown, corrupt, gapped, or unpublished records fail closed.
- Windows reparse metadata is rejected; creation of directory symlinks in tests is conditional on the local Windows privilege/developer-mode policy.
- Automated boundary scanning records the single approved filesystem module but remains defense in depth, not a proof.

## M17 Verification Evidence

- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`: 9 tests passed on Windows after final review corrections.
- `pnpm.cmd --dir apps/desktop check:security`: passed with the exact six-command allowlist and prohibited-capability checks.
- `pnpm.cmd --dir apps/desktop build`: passed.
- `pnpm.cmd check:autonomy-boundaries`: passed with zero violations and the approved filesystem occurrences explicitly reported.
- `cargo fmt --check` and `cargo clippy --all-targets -- -D warnings`: passed.
- `pnpm.cmd verify:project`: passed with all configured checks, including the new Rust/security checks.
- `git diff --check`, dependency diff, platform-boundary diff, prohibited-capability scan, and credential-signature scan: passed; only Git line-ending notices were emitted.

## Validation Commands

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
pnpm --dir apps/desktop check:security
pnpm --dir apps/desktop build
pnpm check:autonomy-boundaries
pnpm verify:project
git diff --check
```

Use `pnpm.cmd` instead of `pnpm` on Windows PowerShell when script execution policy blocks `pnpm.ps1`.

## Handoff Checklist

1. Inspect Git branch, HEAD, tag, and worktree.
2. Read `docs/platform-boundaries.md` without editing it.
3. Read `docs/autonomy-policy.md` and `docs/execution/active-plan.md`.
4. Review the decided scope and every still-blocked gate.
5. Run the validation scope relevant to the current checkpoint.
6. Update this file and append the progress log after the checkpoint.
