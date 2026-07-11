# ADR 0007: Compatibility Analysis Engine

## Status

Accepted for M15.

## Context

M13 defined provider-neutral resolution contracts and M14 implemented the first metadata provider. A normalized `ResourceCandidate` still describes one provider's claims; it does not prove that a collection is suitable for the requested Minecraft environment or that its dependencies and explicit rules are satisfied.

M15 adds an auditable compatibility layer between resolution and plan construction:

```text
Resource Resolver
  -> ResourceCandidate[]
  -> Compatibility Analysis Engine
  -> CompatibilityAnalysisResult
  -> compatibility-aware Resource Plan
```

## Problem Statement

Planning without a separate analysis step risks treating missing metadata as success, ignoring required dependencies, hiding duplicate selections, or allowing provider-specific assumptions to decide the final result. Conversely, placing these checks in a future Executor would expose local execution decisions to unresolved metadata ambiguity.

The system needs deterministic resource-level and collection-level analysis with structured severity, explicit uncertainty, and no side effects.

## Independence From Providers

Providers fetch and normalize metadata. They do not decide final compatibility because:

- multiple providers can represent the same project differently;
- compatibility policy must be stable across providers;
- provider availability and response order must not alter rule semantics;
- provider metadata can be incomplete or contradictory;
- explicit project rules must remain version-controlled input, not adapter code.

The Analyzer consumes only standardized `ResourceCandidate` fields. It imports no provider client and performs no fetch.

## Independence From Execution

Compatibility analysis belongs to the Planner Plane. It has no path, filesystem, process, Java, installer, launcher, or rollback handle. The future Local Executor may consume a user-confirmed plan, but cannot use execution success to retroactively invent compatibility.

M15 produces evidence and policy decisions only. It does not download, install, launch, repair, replace, remove, or rewrite candidates.

## Input Contracts

The Analyzer accepts:

- ordered `ResourceCandidate[]` metadata;
- `CompatibilityTarget` with exact Minecraft version, loader, and side;
- optional dependency candidates used only for graph lookup;
- optional explicit `CompatibilityRule[]`;
- optional required project IDs;
- an explicit unknown policy (`warning` by default, `blocker` for strict callers).

Exact version matching is intentional. `1.20` is not inferred to mean `1.20.1`. Fabric, Forge, NeoForge, and Quilt are not treated as interchangeable.

## Output Contracts

`CompatibilityAnalysisResult` contains:

- collection status and normalized target;
- deterministically ordered resource results and issues;
- per-resource check states for version, loader, side, dependencies, conflicts, and metadata;
- blocking resource IDs;
- summary counts;
- `deterministic=true` and `metadataOnly=true`.

Statuses are `compatible`, `compatible_with_warnings`, `incompatible`, and `unknown`. Severities are `info`, `warning`, `error`, and `blocker`.

## Resource-Level Analysis

For each candidate the Analyzer checks:

- exact target Minecraft version membership;
- exact target loader membership;
- client/server support against the requested side;
- metadata verification and completeness;
- required, optional, and incompatible dependency declarations.

Definite version, loader, and side mismatches are blockers. Missing fields remain unknown. `metadataChecked=false` is a warning and prevents a compatible conclusion.

## Collection-Level Analysis

The Analyzer checks:

- repeated stable candidate identities;
- multiple versions or identities for one project;
- ambiguous shared slugs;
- required project IDs missing from all compatibility inputs;
- explicit rules spanning multiple resources;
- required dependency cycles.

The input array is never mutated. Resource results are ordered by stable candidate identity rather than input order.

## Dependency Graph

Required dependencies match a candidate by normalized project ID or slug, with version ID as a secondary identity. Missing required dependencies are blockers. A dependency with no project or version identity is unresolved and blocks. When a project exists but an exact dependency version cannot be verified, the result remains unknown with a warning.

Optional dependency absence is not an issue. Provider-normalized `dependencyType=incompatible` is explicit conflict evidence and produces a blocker.

Required dependency cycles are detected using a visited/active graph traversal. Cycle identities are canonicalized and emitted once in stable order. M15 reports a cycle warning; it does not assume that every metadata cycle makes runtime installation impossible.

## Explicit Conflict Rules

`CompatibilityRule` supports:

- `conflict`;
- `requires`;
- `excludes_loader`;
- `excludes_minecraft_version`;
- `side_constraint`.

Rules select resources only by normalized provider, project ID, slug, or version ID and may include exact target constraints. Every emitted conflict keeps `ruleId`, source, message, and rule-defined severity. Disabled or nonmatching rules have no effect.

No resource-name heuristic exists. M15 does not declare OptiFine and Sodium conflicting unless an explicit rule or provider-normalized incompatible dependency says so.

## Unknown Metadata Handling

Missing versions, loaders, side support, files, hashes, unchecked metadata, unsupported providers, and unverifiable dependency versions are not converted to compatible. Default unknown severity is warning, and status remains `unknown`. Strict callers can promote unknown findings to blocker without changing analyzer logic.

An empty candidate collection is unknown, not compatible.

## Severity And Blocking Policy

- `blocker`: prevents the current collection from proceeding; Plan integration adds an error, sets risk high, and marks the plan rejected.
- `error`: definite analysis problem but not an automatic execution block unless policy promotes it.
- `warning`: remains visible and raises plan risk to at least medium.
- `info`: records evidence without raising risk.

Only blocker severity automatically blocks planning. Warning and unknown findings are never silently dropped.

## Deterministic Ordering

Candidate records are sorted by stable identity. Issues sort by severity, code, resource ID, and a stable key built from sorted related IDs and recursively sorted serializable details. Rules sort by rule ID. Duplicate pairs and dependency cycles are canonicalized. No time, randomness, network response timing, locale-specific resource-name inference, or input mutation affects output.

## Resolver Integration

`resolveAndAnalyzeMetadata` is an explicit composition helper returning:

```text
{ resolution, compatibility }
```

`MetadataResourceResolver.resolve` remains unchanged and backward compatible. The helper respects the caller's resolver network policy. Offline remains zero-fetch. Providers do not call the Analyzer.

## Resource Plan Integration

`applyCompatibilityToResourcePlan` returns a cloned plan:

- blockers enter `ruleResults.errors`, set `riskLevel=high`, and set status to `rejected`;
- warning/error findings enter `ruleResults.warnings` and set risk to at least medium;
- informational findings enter accepted diagnostics;
- existing plan diagnostics remain intact.

The resource-plan schema is not expanded. M15 does not replace candidates, change the requested loader/version, remove resources, or synthesize missing dependencies.

## Security Boundary

The Analyzer and helpers:

- perform no network request;
- import no provider network client;
- read and write no filesystem or local instance;
- execute no shell, child process, Java, installer, launcher, or Minecraft process;
- upload and persist no environment report;
- emit no telemetry;
- use no commercial model API;
- implement no CurseForge provider.

Python MCAgent Server continues to declare `liveResourceResolver=false`. M15 does not change platform responsibilities.

## Alternatives Considered

### Compatibility checks inside each provider

Rejected because results would depend on provider policy and could not analyze cross-provider collections consistently.

### Compatibility checks inside ResourcePlan builder

Rejected because it conflates evidence analysis with presentation/schema mapping and makes standalone diagnostics difficult.

### Compatibility checks inside Local Executor

Rejected because unresolved metadata must be visible before user confirmation and before any component receives local authority.

### Name-based built-in conflict knowledge

Rejected because names are ambiguous and community claims require explicit, reviewable sources and versions.

## Why M15 Does Not Repair

Repair requires candidate replacement policy, user intent tradeoffs, provider queries, and explanation of changed choices. It needs a separate architecture and cannot be hidden inside analysis.

## Why M15 Does Not Install

Installation requires user confirmation, source verification, downloads, hashes, paths, rollback, and failure recovery. Those remain future Desktop Local Executor responsibilities.

## Why M15 Does Not Enable Live Server Resolution

The Python Server does not directly execute the TypeScript resolver. Enabling live capability requires a deliberate runtime integration, cache/rate policy, deployment design, and end-to-end contract tests. M15 keeps the existing offline server declaration honest.

## Future Extension Points

- version-range and semantic compatibility evidence with explicit schemas;
- reviewed community rule packages and provenance;
- optional dependency recommendation policy;
- graph-scale iterative cycle analysis;
- repair/replacement planning as a separate milestone;
- API response schema for compatibility wrappers;
- M16 Local Executor Architecture Design, still without implementation.
