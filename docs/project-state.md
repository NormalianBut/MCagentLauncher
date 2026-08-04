# Project State

This is the primary handoff document for a new Codex session. Read it before the roadmap or active implementation files, then verify its claims against Git and the worktree.

## Release And Baseline

- Package version: `0.1.0`.
- Current release checkpoint: `v0.2-beta-m15`.
- Current tags include `v0.2-beta-m13`, `v0.2-beta-m14`, and `v0.2-beta-m15`.
- Baseline branch: `main`, tracking `origin/main`.
- Baseline commit: `6e277a6` (`Merge pull request #10 from NormalianBut/chore/autonomous-development-governance`).
- Active branch: `codex/m16-local-executor-architecture`, created from the clean synchronized baseline for M16 architecture design.
- M16 review commit: `938f5f7` (`feat(shared-types): define local executor architecture contracts`).
- Draft review: GitHub PR #11 targets `main`; it is not merged.
- Repository-driven governance controls are merged without changing the release tag or enabling runtime capability.

Always run `git status --short --branch` and `git log -1 --oneline --decorate` before relying on this baseline.

## Completed Milestones

- M0-M10: monorepo, schemas, mock planning API, Resolver foundations, Web/Desktop previews, safe probe policy, alpha release preparation.
- M11: runtime topology and endpoint capability negotiation.
- M12: unsigned Windows-first Native Desktop Packaging Preview.
- M13: provider-neutral Resource Resolver architecture.
- M14: Modrinth metadata provider under explicit metadata-only policy.
- M15: deterministic Compatibility Analysis Engine and plan diagnostics.

## Enabled Capabilities

- Offline/mock intent parsing, resource planning, diagnostics, and explanation.
- Schema-validated API response contracts.
- Metadata-only Resolver contracts and an explicit-policy Modrinth metadata adapter.
- Pure compatibility analysis and compatibility-to-plan diagnostics.
- Web/API Playground and Tauri Desktop preview shell.
- Install/executor/environment previews that cannot execute.
- User-consented safe platform probe limited to OS, architecture, app version, and Tauri availability.
- Independent MCAgent endpoint discovery and compatibility validation.

## Disabled Capabilities

- Filesystem writes and local instance mutation.
- Resource, loader, Java, or Minecraft downloads.
- Installation and lockfile persistence.
- Shell, child process, sidecar, Java, launcher, or Minecraft execution.
- Java discovery and Minecraft directory access or scanning.
- OAuth, Microsoft authentication, token persistence, updater, telemetry, and environment upload.
- CurseForge integration and paid AI APIs.
- Live Resolver use by the Python MCAgent Server (`liveResourceResolver=false`).

## Current Objective

M16 Local Executor Architecture Design is complete on its feature branch and awaiting review in draft PR #11. It defines contracts, state machines, threat models, transaction boundaries, and approval requirements without implementing local writes, downloads, installation, process execution, Java access, authentication, or Minecraft launch.

## Next Unblocked Task

Review draft PR #11 and decide DQ-001, DQ-002, and DQ-007. No privileged runtime implementation is unblocked. Keep all runtime entry points disabled and do not cross `GATE-EXEC-01` or `GATE-FS-01` without explicit scoped approval.

## Open Decisions

The authoritative queue is `docs/execution/decision-queue.md`. Current unresolved design decisions concern:

- controlled instance workspace and path containment;
- manifest and transaction representation;
- download trust and integrity policy;
- Java runtime ownership;
- Microsoft authentication and token storage;
- process lifecycle and rollback ownership.

No implementation approval has been granted for these decisions.

## Known Limitations

- The Desktop artifact is unsigned and does not bundle MCAgent Server.
- The Python server uses an offline pipeline adapter and does not expose the TypeScript live Resolver.
- Modrinth support is metadata-only and requires explicit network policy in the TypeScript client.
- Compatibility analysis uses exact versions and does not repair candidates.
- No playable Minecraft instance can be created or launched.
- Automated boundary scanning detects clear repository patterns; it complements, but does not replace, review and threat modeling.
- M16 contracts are architecture evidence only. Digest generation, canonical serialization, path containment, persistence atomicity, runtime rollback, and privileged adapters remain unimplemented and gated.

## M16 Verification Evidence

- `pnpm.cmd verify:project`: passed on 2026-08-04 with 14 schema examples, 84 shared-types tests, 90 API-client tests, Web/Desktop builds, 26 server tests, and an autonomy scan of 197 files with zero violations.
- `pnpm.cmd check:autonomy-boundaries`: passed independently with zero violations.
- Isolated TypeScript check for `packages/shared-types/src/localExecutor.ts`: passed.
- `git diff --check`: passed with line-ending notices only.
- Manual review found no runtime I/O implementation, production dependency, credential signature, safety-check weakening, or `docs/platform-boundaries.md` change.

## Validation Commands

```bash
pnpm validate:schemas
pnpm test:shared-types
pnpm test:api-client
pnpm --dir apps/web build
pnpm --dir apps/desktop build
cd services/mcagent-server && python -m pytest -q
pnpm check:autonomy-boundaries
pnpm verify:project
git diff --check
```

Use `pnpm.cmd` instead of `pnpm` on Windows PowerShell when script execution policy blocks `pnpm.ps1`.

## Handoff Checklist

1. Inspect Git branch, HEAD, tag, and worktree.
2. Read `docs/platform-boundaries.md` without editing it.
3. Read `docs/autonomy-policy.md` and `docs/execution/active-plan.md`.
4. Review pending decisions and risks before proposing implementation.
5. Run the validation scope relevant to the next checkpoint.
6. Update this file and append the progress log after the checkpoint.
