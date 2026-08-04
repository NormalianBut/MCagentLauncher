# MCagentlauncher Docs

This directory documents the released MCagentlauncher v0.1 Alpha Preview, the v0.2-beta-m15 architecture checkpoint, and the repository-driven development controls for M16 and later work.

## Start Here

- [Project State](./project-state.md): primary handoff for a new Codex session.
- [Autonomy Policy](./autonomy-policy.md): AUTO, REVIEW, and GATED work.
- [Active Plan](./execution/active-plan.md): current checkpoint and verification state.
- [First Playable Plan](./execution/first-playable-plan.md): proposed stages and explicit capability gates.
- [Progress Log](./execution/progress-log.md): append-only execution evidence.
- [Decision Queue](./execution/decision-queue.md): unresolved choices; entries are not approvals.
- [Risk Register](./execution/risk-register.md): future Execution Plane risks and controls.

## Architecture

- [Architecture](./architecture.md)
- [Platform Boundaries](./platform-boundaries.md)
- [Desktop Executor Design](./desktop-executor-design.md)
- [API Playground Prep](./api-playground-prep.md)
- [Native Desktop Packaging Preview](./native-desktop-packaging-preview.md)

## Security

- [Security](./security.md)
- [Environment Probe Design](./environment-probe-design.md)
- [Read-only Probe Permission Policy](./read-only-probe-permission-policy.md)

## ADRs

- [ADR 0001: Read-only Environment Probe](./adr/0001-read-only-environment-probe.md)
- [ADR 0002: Safe Platform Probe](./adr/0002-safe-platform-probe.md)
- [ADR 0003: Post-alpha Runtime Topology](./adr/0003-beta-runtime-topology.md)
- [ADR 0004: Native Desktop Packaging Preview](./adr/0004-native-desktop-packaging-preview.md)
- [ADR 0005: Resource Resolver Architecture](./adr/0005-resource-resolver-architecture.md)
- [ADR 0006: Modrinth Metadata Provider](./adr/0006-modrinth-metadata-provider.md)
- [ADR 0007: Compatibility Analysis Engine](./adr/0007-compatibility-analysis-engine.md)
- [ADR 0008: Local Executor Architecture and Authority Boundary](./adr/0008-local-executor-architecture.md)

## Releases

- [v0.1 Alpha Preview Notes](./releases/v0.1-alpha-preview.md)
- [v0.1 Alpha GitHub Release Draft](./releases/v0.1-alpha-github-release-draft.md)
- [v0.1 Alpha Release Candidate Checklist](./releases/v0.1-alpha-release-candidate-checklist.md)
- [v0.1 Alpha Checklist](./releases/v0.1-alpha-checklist.md)
- [v0.1 Alpha Manual Review Notes](./releases/v0.1-alpha-manual-review.md)
- [v0.1 Alpha Screenshot Checklist](./releases/v0.1-alpha-screenshot-checklist.md)
- [v0.1 Alpha Known Limitations](./releases/v0.1-alpha-known-limitations.md)
- [v0.1 Alpha Feedback Guide](./releases/v0.1-alpha-feedback.md)
- [M12 Native Desktop Preview Checklist](./releases/m12-native-desktop-preview-checklist.md)
- [M14 Modrinth Provider Review](./releases/v0.2-m14-review.md)
- [M15 Compatibility Analysis Review](./releases/v0.2-m15-review.md)

## Demo

- [v0.1 Alpha Demo Flow](./demo/v0.1-alpha-demo-flow.md)

## Repository Controls

- Root [`AGENTS.md`](../AGENTS.md) defines operating rules and Definition of Done.
- Root [`PLANS.md`](../PLANS.md) defines durable execution-plan structure.
- `pnpm check:autonomy-boundaries` performs a read-only, repository-scoped scan for clear runtime privilege violations.
- `pnpm verify:project` runs the current schemas, tests, builds, boundary scan, and Git whitespace check.

## Alpha Boundary

v0.1 alpha preview does not install or launch Minecraft. It does not download resources, write local instances, detect Java, scan Minecraft directories, or upload environment reports.
