# Project State

This is the primary handoff document for a new Codex task. Verify it against Git and the external Autonomy Lab control directory before relying on it.

## Release And Baseline

- Package version: `0.1.0`.
- Current release checkpoint: `v0.2-beta-m17`.
- Baseline branch/commit: clean synchronized `main` at `884403e66d84498d64263ec48c663efee50bb278` (merged M17).
- Active branch: `codex/m18-autonomy-recovery`, created from that baseline.
- M18 feature commit: `2815147d0695df28f1cfe1e563512f3740576bc3` (`feat: add interruption-resilient autonomy runtime`).
- Draft PR #13 targets `main`; M18 is not merged, tagged, or released.

## Completed Milestones

- M0-M16: Planner, preview, metadata/compatibility, packaging preview, and Local Executor architecture contracts.
- M17: approved controlled-workspace simulation with fixed app-data boundary, journal, recovery, and current-transaction test-artifact rollback.

## Current Objective

M18 adds interruption-resilient repository tooling: an external runtime checkpoint, branch work-package checkpoint, verified-integration discipline, single-coordinator lease/heartbeat, PAUSE/STOP, conservative resume/doctor/cleanup, resource modes, and bounded ownership-verifying process supervision. Implementation, verification, push, and Draft PR handoff are complete; human review remains.

## Enabled Capabilities

- All merged M17 Planner/Desktop preview and controlled-workspace simulation capabilities.
- On the M18 feature branch only: repository tooling may write its configured external control directory and `docs/execution/resume-packet.md`, inspect Git, and directly supervise bounded development/test processes inside the active worktree.
- Process ownership uses a PID-plus-nonce named-pipe/socket challenge; logs and evidence are preserved.

## Disabled Capabilities

- Desktop/Tauri product process/shell/sidecar authority.
- Java, Minecraft, launcher, or game execution and discovery.
- Resource/runtime downloads, network installation, existing `.minecraft` or third-party instance access, arbitrary/user-selected paths, and real instance mutation.
- OAuth, tokens, telemetry, updater, environment upload, commercial APIs, production dependency additions, automatic spending, merge, tag, and Release.

## Current Evidence

- `pnpm.cmd test:autonomy-runtime`: 15 tests passed on Windows.
- Initial Windows CIM command-line identity inspection failed with access denied; the design failed closed and was replaced by a no-administrator local nonce challenge.
- Focused tests cover path containment, missing/corrupt state, competing/stale lease, repeated/clean pause, clean resume, crash/interrupted package, uncommitted Git work, preserved failure logs, timeout/tree termination, pause during a child, PID-reuse defense, idempotent doctor/cleanup, and recovery without deletion.
- `pnpm.cmd verify:project` passed: 15 autonomy tests, 14 schema examples, 84 shared-types tests, 90 API-client tests, Web/Desktop builds, 9 Rust tests, Desktop security, 26 server tests, the boundary scan, and whitespace check. The two existing Python warnings remain non-failing.
- Targeted secret, TODO/FIXME, dependency, platform-boundary, local-path, and prohibited-capability scans passed. Matches were exact Java rejection/tests and historical TODO/FIXME references only.

## Next Exact Action

Review Draft PR #13. Do not merge or cross any product/download/Java/OAuth/process/release gate without separate approval.

## Open Decisions And Risks

- DQ-008 approves only the M18 repository-tooling exception.
- DQ-003 through DQ-006 remain open for download trust, Java ownership, authentication, and Desktop process lifecycle.
- R-014 through R-016 track coordinator interruption, unrelated-process termination, and destructive recovery. See the risk register for mitigations.

## Validation Commands

```bash
pnpm.cmd test:autonomy-runtime
pnpm.cmd verify:project
pnpm.cmd check:autonomy-boundaries
git diff --check
```

## Interruption Handoff

1. Run `pnpm.cmd autonomy:status` and `pnpm.cmd autonomy:doctor`.
2. Read `docs/autonomy-interruption-recovery.md`, `docs/execution/active-plan.md`, and `docs/execution/resume-packet.md`.
3. Inspect Git status/worktrees; never reset or delete uncommitted work automatically.
4. Resume only the exact recorded next action as a newly validated bounded unit.
5. Keep `docs/platform-boundaries.md` unchanged.
