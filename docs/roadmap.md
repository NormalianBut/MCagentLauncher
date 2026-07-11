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
- M14 preparation: provider conformance fixtures, deterministic offline orchestration, and capability negotiation; no downloads or execution.
