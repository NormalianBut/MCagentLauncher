# Roadmap

## v0.1 - Natural Instance

Goal: natural language -> resource plan -> user confirmation -> local execution -> launchable Minecraft Fabric instance.

Initial milestones:

- M0: repository bootstrap, docs, GitHub templates, license draft.
- M1: JSON schemas for intent, resource plans, install actions, and lockfiles.
- M2: MCAgent server mock with health, intent, planning, and explanation endpoints.
- M3: resource resolver MVP focused on Fabric and Modrinth metadata.
- M4: desktop UI mock for input, plan review, and install progress.
- M5: local executor MVP for instance creation, hash verification, lockfile writing, and rollback basics.
- M6: launch smoke test with Java detection and log capture.

## Later Directions

- Better diagnosis and repair planning.
- Community alias and rule workflows.
- Self-hostable MCAgent nodes.
- Broader loader and resource type support after the Fabric-first flow is stable.

## v0.2 Beta Planning

- M11: runtime topology and endpoint capability negotiation (complete).
- M12: Windows-first native Desktop packaging preview (complete).
- M13: provider-neutral Resource Resolver architecture and contracts (design).
- M14: Modrinth metadata provider, strict normalization, deterministic registry/orchestration, and metadata-only policy.
- M15: deterministic metadata-only compatibility analysis for version, loader, side, dependencies, duplicates, and explicit rules.
- M16: Local Executor Architecture Design complete; ADR 0008 and pure contracts define reviewed-plan handoff, workspace trust classes, permissions, confirmation, manifest/transaction states, rollback/recovery, audit, failures, and later gates.
- M17: controlled workspace and transaction foundation in progress under explicitly approved DQ-001, DQ-002, and DQ-007 restrictions. It adds only an app-data-owned synthetic test workspace, versioned persistence, and simulated recovery/rollback; downloads, installation, Java, authentication, processes, Minecraft access, and launch remain disabled.

## Repository-driven Execution

M16 and later work use `docs/project-state.md` as the primary handoff, `docs/execution/active-plan.md` as the current checkpoint, and the append-only progress log, decision queue, and risk register as durable evidence. `AGENTS.md`, `PLANS.md`, and `docs/autonomy-policy.md` define operating rules and approval boundaries.

The proposed path after M16 is documented in `docs/execution/first-playable-plan.md`:

1. controlled instance workspace;
2. manifest and transaction model;
3. verified resource download;
4. loader/runtime preparation;
5. Java runtime policy;
6. authentication;
7. Minecraft process lifecycle;
8. rollback/recovery and first playable validation.

Only the first application-managed controlled-workspace and transaction-foundation slice is approved. Explicit approval is still required before user-selected location access, network download, Java access, process launch, OAuth use, production dependency, real installation, and playable release. Updater, sidecar, and existing Minecraft directory access are separately gated and excluded from First Playable.
