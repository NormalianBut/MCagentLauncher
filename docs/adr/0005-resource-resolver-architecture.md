# ADR 0005: Resource Resolver Architecture

## Status

Accepted for M13 design. Provider implementations beyond the existing Modrinth metadata prototype are not authorized by this ADR.

## Problem Statement

The Planner can understand a request such as "Fabric 1.20.1 performance survival with AppleSkin", but names and goals are not installable identities. A useful plan needs project identifiers, compatible versions, loader and game-version claims, dependency metadata, side support, and available file hashes from independently evolving metadata sources.

Putting provider-specific assumptions directly in the Planner would make planning nondeterministic, difficult to test, and coupled to one external platform. Passing unresolved names to the future Local Executor would move ambiguity into the component with filesystem and process authority. A separate Resource Resolver is therefore required.

## Pipeline

```text
Natural Language Intent
        |
        v
Planner
  creates ResourceRequirement[]
        |
        v
Resource Resolver
  selects providers, normalizes metadata,
  evaluates compatibility, ranks candidates
        |
        v
Metadata Provider adapters
  Modrinth | GitHub Releases | MC百科 metadata
  CurseForge (future, not implemented)
```

The return flow is normalized `ResourceCandidate` matches plus diagnostics. It is metadata, not an execution instruction and not proof that a file has been downloaded or installed.

## Responsibilities

### Planner

- understands structured intent, goals, aliases, constraints, and risk preference;
- creates provider-neutral `ResourceRequirement` records;
- explains why each requirement exists;
- converts resolver matches and diagnostics into a reviewable resource plan;
- does not call provider-specific formats directly.

### Resource Resolver

- accepts explicit requirements, allowed providers, risk preference, and network policy;
- asks only eligible metadata providers;
- normalizes provider results into the shared resource metadata model;
- evaluates Minecraft version, loader, side, release channel, dependency, and metadata completeness claims;
- deduplicates and deterministically ranks candidates;
- preserves ambiguity, missing metadata, rate limits, and compatibility failures as diagnostics;
- never downloads an artifact or performs local execution.

### Metadata Provider

- adapts one external metadata source to the shared contracts;
- declares capabilities before use;
- returns source identities and metadata without hiding uncertainty;
- does not decide the final resource plan;
- does not download files even when metadata contains a download URL.

## Planner Plane Relationship

The Resource Resolver belongs to the MCAgent Planner Plane. It is a deterministic metadata subsystem, not a model tool with open-ended authority. Planner output remains schema-verifiable. A configured endpoint must continue to declare resolver availability through the M11 capability contract before clients rely on live metadata.

Default behavior remains offline. A future implementation may use network metadata only when the request explicitly sets `networkPolicy="metadata-only"` and the endpoint advertises the corresponding capability. Paid AI APIs are unrelated to resolution and are not introduced.

## Future Local Executor Relationship

The future Desktop Local Executor consumes a user-reviewed plan; it does not receive provider adapters through this contract. Resolver metadata may identify a future artifact URL and expected hashes, but that does not grant permission to fetch it. After explicit user confirmation, a separately authorized Executor milestone must independently enforce source policy, hash verification, target paths, rollback, and failure handling.

The Resolver cannot access local instances, Minecraft directories, Java, environment reports, filesystems, shells, processes, launchers, or credentials owned by Desktop.

## Decision

Adopt one provider-neutral `ResourceResolver` interface with capability-declaring `MetadataProvider` adapters.

The shared contract consists of:

- `ResourceRequirement`: Planner-owned resource need and provider hints;
- `ResourceResolutionRequest`: schema version, ordered requirements, ordered allowed providers, risk preference, and explicit network policy;
- `ResourceMetadata`: normalized provider project/version compatibility metadata;
- generic `ResourceCandidate<ProviderId>`: metadata plus warnings and resolver provenance;
- `ProviderCapability`: supported operations, lifecycle stage, authentication expectation, and fixed safety declarations;
- `ResourceResolutionResult`: ordered matches and structured diagnostics;
- `ResourceResolver` and `MetadataProvider`: interfaces only.

Provider order is input data. Requirements retain their input order. Within a requirement, future implementations must sort by compatibility, confidence descending, provider order, then stable candidate identity (`provider:projectId:versionId`). Identical stable identities are deduplicated. Providers must not use wall-clock time, random values, or response arrival order for ranking.

## Provider Plan

### Initial architecture targets

- **Modrinth**: search, project/version compatibility, dependency, file, and hash metadata. An existing prototype client remains unchanged by M13.
- **GitHub Releases**: repository and release metadata plus published checksum metadata when present. It is not assumed to contain Minecraft compatibility data.
- **MC百科 metadata (`mcmod`)**: discovery and compatibility context. It is metadata context, not a resource mirror or trusted artifact source.

### Future

- **CurseForge**: represented only as a disabled future capability. M13 adds no API client, key, request, or integration behavior.

Provider claims are not automatically equivalent. Missing loader/version/hash/license data must remain incomplete rather than being inferred.

## Alternatives Considered

### Provider logic inside Planner

Rejected because it couples intent reasoning to external APIs, complicates deterministic tests, and makes provider failures contaminate planning logic.

### Provider logic inside Desktop

Rejected because it mixes metadata ambiguity with the future Execution Plane and unnecessarily expands Desktop network authority before user confirmation.

### Modrinth-only contract

Rejected because source-specific fields would require repeated schema changes for GitHub Releases and community metadata.

### Central resource mirror

Rejected. Supabase, Vercel, MCAgent, and MC百科 metadata must not become Minecraft binary mirrors. Upstream source policy remains authoritative.

## Security Boundaries

M13 contracts and tests guarantee that provider capabilities declare:

- metadata only;
- no resource download;
- no upload;
- no filesystem or local instance access;
- no shell, process, launcher, or Java execution;
- no telemetry.

M13 performs no new network calls. Future metadata networking must be explicit, bounded to declared provider operations, rate-limit aware, and free of credentials embedded in logs or candidate output. Environment reports and local paths never enter resolver requests.

## Failure Model

Provider unavailability, unsupported operations, missing projects or versions, loader/game-version mismatches, ambiguity, incomplete metadata, and rate limits are data-level diagnostics. One provider failure does not silently become a successful match. A plan may remain incomplete, but must not fabricate IDs, versions, hashes, or compatibility.

## Future Extension Points

- provider adapter implementations and contract tests;
- M11 capability negotiation for live metadata availability;
- provider-specific rate-limit and cache policy without binary mirroring;
- license and provenance metadata;
- richer compatibility evidence and dependency graphs;
- explicit resolver response JSON Schema if the contract crosses an API boundary;
- additional providers through a new capability entry and security review;
- Local Executor handoff only after a separate execution ADR and user-confirmation design.

M14 should implement provider conformance fixtures and an offline resolver orchestrator first. Any live network path should be a later opt-in step with mocked tests and no download behavior.
