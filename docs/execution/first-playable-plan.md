# First Playable Preview Plan

## Objective

Move from `v0.2-beta-m15` to a narrowly controlled First Playable Preview through independently reviewed architecture and capability gates. This document is a high-level roadmap only and does not authorize implementation.

## Verifiable Stopping Condition

A future First Playable Preview may be declared only when a clean, isolated test instance can be created from an approved plan, all downloaded bytes are source- and hash-verified, authentication and Java policy are approved, Minecraft starts under controlled lifecycle management, failure recovery is demonstrated, and the release gate is explicitly approved.

## Baseline

- Release checkpoint: `v0.2-beta-m15`.
- Planner Plane produces schema-validated plans and compatibility diagnostics.
- Desktop is preview-only; execution capabilities are disabled.
- No write, download, Java, OAuth, process launch, or Minecraft launch authority exists.

## Scope

Future design and gated implementation of a minimal Desktop Local Executor for a project-controlled instance workspace, verified resource acquisition, runtime preparation, authentication, launch, and rollback.

## Non-goals

- Modifying a user's existing `.minecraft` installation.
- Broad launcher replacement, modpack management, auto-update, telemetry, or background services.
- Bypassing upstream licenses, APIs, authentication, or redistribution rules.
- Enabling any stage merely because it appears later in this plan.

## Architecture And Security Impact

The plan crosses from Planner Plane data into Execution Plane authority. Each capability must remain unavailable until its explicit gate is approved. Plans are untrusted input; the Executor must independently validate paths, sources, hashes, state transitions, and user confirmation.

## Proposed Stages

### Stage 1: M16 Local Executor Architecture Design

Define the Executor contract, controlled workspace, confirmation token, transaction state machine, capability interfaces, failure model, threat model, and audit events. Use pure contracts and tests only. No runtime privileges.

### Stage 2: Controlled Instance Workspace

Design and, only after approval, implement a dedicated project-owned root with canonical path containment, symlink/reparse-point defenses, no traversal, no existing-instance mutation, and explicit lifecycle ownership.

**GATE-FS-01: stop before the first filesystem write.** Required evidence: accepted M16 ADR, path threat model, containment tests, rollback plan, dependency review, and explicit approval.

### Stage 3: Manifest And Transaction Model

Define immutable intent/plan provenance, expected artifacts, staged/committed states, idempotency, journaling, atomic transitions where supported, and recovery from interruption. The model must distinguish planned, staged, verified, committed, failed, and rolled-back state.

### Stage 4: Resource Download And Integrity Verification

Design source allowlists, redirects, size limits, timeouts, temporary staging, hash algorithms, hash-required policy, mismatch handling, retry limits, cancellation, and cleanup. URL metadata is never equivalent to trusted bytes.

**GATE-NET-01: stop before the first network download.** Required evidence: accepted source/integrity ADR, provider terms review, malicious-response tests, partial-file cleanup design, production dependency approval, and explicit approval.

### Stage 5: Loader And Runtime Preparation

Define Fabric-first metadata, installer provenance, version pinning, generated files, classpath inputs, and deterministic manifest updates. Forge and NeoForge remain out of scope until separately approved.

### Stage 6: Java Runtime Policy

Decide whether Java is user-provided, discovered under consent, or provisioned from an approved source. Define supported versions, signature/hash policy, executable path handling, arguments, memory limits, and platform differences.

Java discovery, provisioning, and execution remain separately gated.

### Stage 7: Authentication

Design Microsoft OAuth flow, redirect handling, scopes, token storage, refresh, revocation, account selection, redaction, and offline behavior. Keep authentication outside MCAgent and Web surfaces.

**GATE-OAUTH-01: stop before the first OAuth use.** Required evidence: accepted auth ADR, app registration ownership, secret/token threat model, secure storage decision, privacy review, dependency approval, and explicit approval.

### Stage 8: Minecraft Process Launch

Define a fixed executable/argument contract, environment allowlist, no shell interpolation, output redaction, cancellation, timeout, child cleanup, crash classification, and exit reporting.

**GATE-PROC-01: stop before the first process launch.** Required evidence: accepted Java and process ADRs, argument-injection tests, cleanup tests, user confirmation UX, production dependency approval, and explicit approval.

### Stage 9: Rollback And Recovery

Validate recovery from interruption at every transaction state. Rollback must affect only the controlled workspace, preserve diagnostics, avoid deleting pre-existing user data, and report incomplete cleanup for manual review.

### Stage 10: First Playable Validation

Run an isolated, documented matrix covering supported Windows version, Minecraft/Fabric version, authenticated launch, clean shutdown, cancellation, hash mismatch, network interruption, failed loader preparation, process crash, and rollback.

**GATE-REL-01: stop before the first playable release.** Required evidence: all prior gates, complete test matrix, security review, license/source audit, checksum and artifact provenance, known limitations, manual review, and explicit release approval.

## Tests And Boundary Scan

Every stage keeps current schema/tests/builds green and adds targeted contract, failure, and security tests before capability code. Run `pnpm verify:project`, Desktop security checks, platform-specific tests, dependency audit, secret scan, and a manual diff of `docs/platform-boundaries.md`.

## Rollback

Before runtime capability exists, rollback is Git-only removal of the scoped branch. Future runtime rollback must use the transaction journal and controlled workspace; it must never infer paths or delete outside its owned root. A failed rollback blocks release.

## Approval Gates

| Gate | Capability | Status |
|---|---|---|
| GATE-FS-01 | First filesystem write | Not requested |
| GATE-NET-01 | First network download | Not requested |
| GATE-PROC-01 | First process launch | Not requested |
| GATE-OAUTH-01 | First OAuth use | Not requested |
| GATE-REL-01 | First playable release | Not requested |

## Progress And Completion Reporting

Each stage must update `docs/project-state.md`, `docs/execution/active-plan.md`, the append-only progress log, decision queue, and risk register. A stage report must list changed files, contract/state transitions, privileges added, gate evidence, tests, regressions, rollback evidence, and the next blocked or unblocked action.
