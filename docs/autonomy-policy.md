# Autonomy Policy

This policy classifies repository work by the authority Codex may exercise. The highest applicable class controls the whole affected checkpoint.

## AUTO

Codex may complete AUTO work without additional approval when it preserves architecture and security boundaries.

Examples:

- read-only repository inspection and test execution;
- documentation indexes, handoff state, progress logs, and corrections that do not change policy;
- deterministic contract tests and refactors with no new capability;
- schema examples and validation improvements that remain backward compatible;
- architecture proposals, threat models, and ADR drafts that do not authorize implementation;
- non-destructive repository checks.

AUTO work still requires tests, boundary review, accurate documentation, and no secret exposure.

## REVIEW

Codex may implement REVIEW work on a feature branch and may prepare a Pull Request, but must not merge it.

Examples:

- Planner Plane behavior within already approved capabilities;
- backward-compatible public contract additions;
- metadata provider normalization under an already approved metadata-only network policy;
- UI behavior that does not gain local authority;
- CI and build changes that use existing dependencies and privileges.

The PR must expose architecture impact, security impact, test evidence, known limitations, and any downstream gate. Human review is required before merge.

## GATED

Codex must stop before implementation and request explicit approval for:

- filesystem write access;
- any resource, runtime, loader, or game download implementation;
- process, shell, command, or sidecar execution;
- Java discovery, selection, provisioning, or execution;
- Minecraft directory access, scanning, or discovery;
- authentication, secrets, credentials, or token persistence;
- Microsoft OAuth;
- local instance creation or mutation;
- updater or sidecar behavior;
- license changes;
- production dependency additions or upgrades that materially expand runtime authority;
- merge into `main`, tag creation or movement, or Release creation.

Approval must identify the capability, intended scope, security evidence, rollback strategy, and branch or plan checkpoint. Approval of an ADR, roadmap, mock, schema, or preview is not implementation approval. Silence, an old milestone label, and a prior unrelated approval do not count.

## Additional Protected Actions

- `docs/platform-boundaries.md` requires explicit approval before modification.
- History rewrites and force pushes are prohibited, not merely gated.
- Secrets must never be committed or printed.
- Production actions must never be inferred from a request to design or document them.

## Approved M18 Repository-Tooling Exception

On 2026-08-04 the user explicitly requested the interruption-resilient Autonomy Lab runtime on a scoped Codex feature branch. That request approves external control-directory writes and direct bounded process supervision only in the exact `scripts/autonomy-*.mjs` development-tooling scope, with harmless tests, ownership verification, preserved evidence, and no administrator requirement. It does not approve any Desktop/Tauri product process API, shell surface, Java/Minecraft execution, download, existing user-data access, authentication, sidecar, or production dependency. The boundary scanner must keep this exception file-specific; moving the authority into product code requires a new gate.

## Gate Procedure

1. Record the decision in `docs/execution/decision-queue.md`.
2. State the exact implementation boundary and evidence needed.
3. Complete all independent AUTO design and verification work.
4. Stop before the first gated code or dependency change.
5. After explicit approval, record the user response and scope before continuing.

## Classification Examples

| Work | Class | Reason |
|---|---|---|
| M16 Local Executor ADR and pure contracts | AUTO | Design only; no authority enabled |
| Planner diagnostic behavior change | REVIEW | Product behavior within Planner Plane |
| Add a filesystem crate to create instances | GATED | First local write authority |
| Add a downloader, even without calling it | GATED | Download capability and production dependency |
| Open a draft PR for approved REVIEW work | REVIEW | Allowed handoff; no merge |
| Merge, tag, or publish a Release | GATED | Repository publication authority |
