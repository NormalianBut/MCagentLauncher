# Active Plan: M16 Local Executor Architecture Design

## Objective

Define the future Desktop Local Executor architecture without implementing or enabling any runtime capability.

## Verifiable Stopping Condition

M16 is complete when an accepted-for-review ADR and deterministic, side-effect-free contracts define ownership, controlled workspace constraints, confirmation, transaction states, capability interfaces, errors, rollback obligations, and approval gates; all project verification passes; no runtime privilege is added.

## Current Checkpoint

Checkpoint 0: governance and architecture baseline ready. M16 implementation planning has not started.

## Completed Work

- M13-M15 established Resolver, metadata provider, and compatibility boundaries in the Planner Plane.
- The Desktop remains preview-only and MCAgent remains planner-only.
- Repository autonomy policy, project-state handoff, decision queue, risk register, and First Playable roadmap are available.

## Next Actions

1. Re-inspect current Executor preview contracts and ADR history.
2. Draft the M16 ADR with Execution Plane ownership and threat model.
3. Define pure contracts/state transitions only if needed to make the ADR testable.
4. Add deterministic contract tests with no filesystem, network, or process API.
5. Run the full verification and boundary audit.
6. Update project state, progress log, decisions, risks, architecture, security, and roadmap.

## Scope

- Architecture, pure data contracts, state-machine invariants, threat model, diagnostics, and gate definitions.
- Relationship from a user-confirmed Resource Plan to a future Executor request.

## Non-goals

- Filesystem reads or writes, path discovery, instance creation, or lockfile persistence.
- Downloads, installation, Java discovery/execution, OAuth, shell/process launch, Minecraft launch, updater, or sidecar.
- Production dependency additions.

## Blockers

No blocker prevents architecture design. Every runtime implementation stage is blocked by the applicable decision and explicit approval gate.

## Approval Requirements

- M16 design and pure contracts: AUTO, provided no capability is enabled.
- Any production dependency or runtime implementation: GATED; stop before changes.
- `docs/platform-boundaries.md`: explicit approval required before any edit.
- Merge, tag, and Release: GATED and outside M16 implementation work.

## Verification Status

- Baseline at `v0.2-beta-m15`: established by prior M15 review.
- Governance verification: passed on 2026-08-04 through `pnpm.cmd verify:project` (14 schema examples, 72 shared-types tests, 90 api-client tests, Web/Desktop builds, 26 server tests, 194-file boundary scan with zero violations, and Git whitespace check).
- Existing server warnings: Starlette/httpx deprecation and denied pytest cache creation; neither is counted as a passed check.
- M16 tests and artifacts: not started.

## Rollback

M16 design work must remain removable as a scoped Git change. Because it cannot gain runtime authority or write user data, rollback requires no local-instance cleanup.
